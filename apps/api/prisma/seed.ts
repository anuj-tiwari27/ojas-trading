/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface SeedData {
  products: { code: string; name: string; marketRate: number; unit: string }[];
  parties: { name: string; type: string; city: string | null; phone: string | null; notes: string | null }[];
  direct: any[];
  degum: any[];
}

const data: SeedData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf-8'),
);

// ── Permission catalogue ────────────────────────────────────────────────────
const RESOURCES = [
  'dashboard', 'party', 'product', 'directdeal', 'degum',
  'position', 'audit', 'user', 'settings',
];
const ACTIONS = ['read', 'create', 'update', 'delete'];
const EXTRA = ['report:export'];

function permissionKeys(): string[] {
  const k = new Set<string>();
  for (const r of RESOURCES) for (const a of ACTIONS) k.add(`${r}:${a}`);
  for (const e of EXTRA) k.add(e);
  return [...k];
}

const DEAL_RESOURCES = ['directdeal', 'degum', 'position'];
const ROLE_POLICY: Record<string, (k: string) => boolean> = {
  ADMIN: () => true,
  MANAGEMENT: (k) => k.endsWith(':read') || k === 'report:export',
  TRADER: (k) =>
    k.startsWith('dashboard') || k.startsWith('party') || k.startsWith('product') ||
    DEAL_RESOURCES.some((d) => k.startsWith(d)),
  FINANCE: (k) =>
    k.startsWith('dashboard') || k.startsWith('position') || k === 'report:export' ||
    k === 'party:read' || k === 'product:read' || k === 'directdeal:read' || k === 'degum:read',
  OPERATIONS: (k) =>
    k.startsWith('dashboard') || k === 'directdeal:read' || k === 'degum:read' ||
    k === 'party:read' || k === 'product:read',
  VIEWER: (k) => k.endsWith(':read'),
};
const ROLES = [
  { key: 'ADMIN', name: 'Administrator', description: 'Full access' },
  { key: 'MANAGEMENT', name: 'Management', description: 'Oversight + reports' },
  { key: 'TRADER', name: 'Trader', description: 'Create & manage deals' },
  { key: 'FINANCE', name: 'Finance', description: 'Position, payments, reports' },
  { key: 'OPERATIONS', name: 'Operations', description: 'Deal logistics' },
  { key: 'VIEWER', name: 'Viewer', description: 'Read-only' },
];

const num = (v: any) => Number(v ?? 0);
const r4 = (n: number) => Number(n.toFixed(4));
const dOrNull = (v: any) => (v ? new Date(v) : null);

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ojastrading.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

  console.log('▶ Permissions…');
  for (const key of permissionKeys()) {
    const [resource, action] = key.split(':');
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key, resource, action } });
  }
  const allPerms = await prisma.permission.findMany();

  console.log('▶ Company…');
  const company = await prisma.company.upsert({
    where: { gstin: '27ABCDE1234F1Z5' },
    update: {},
    create: {
      name: 'Ojas Trading Co.',
      legalName: 'Ojas Edible Oils',
      gstin: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      email: 'contact@ojastrading.com',
      city: 'Kandla',
      state: 'Gujarat',
    },
  });

  console.log('▶ Roles…');
  const roleByKey: Record<string, string> = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { companyId_key: { companyId: company.id, key: r.key } },
      update: { name: r.name, description: r.description },
      create: { companyId: company.id, ...r, isSystem: true },
    });
    roleByKey[r.key] = role.id;
    const policy = ROLE_POLICY[r.key];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: allPerms.filter((p) => policy(p.key)).map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log('▶ Admin user…');
  const admin = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: adminEmail } },
    update: {},
    create: {
      companyId: company.id,
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword),
      fullName: 'System Administrator',
      isSuperAdmin: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleByKey['ADMIN'] } },
    update: {},
    create: { userId: admin.id, roleId: roleByKey['ADMIN'] },
  });

  // ── Products ──────────────────────────────────────────────────────────────
  console.log(`▶ Products (${data.products.length})…`);
  const productByCode = new Map<string, { id: string; marketRate: number }>();
  for (const p of data.products) {
    const row = await prisma.product.upsert({
      where: { companyId_code: { companyId: company.id, code: p.code } },
      update: { name: p.name, marketRate: p.marketRate, unit: p.unit, marketRateUpdatedAt: new Date() },
      create: { companyId: company.id, code: p.code, name: p.name, unit: p.unit || 'MT', marketRate: p.marketRate, marketRateUpdatedAt: new Date() },
    });
    productByCode.set(p.code.toLowerCase(), { id: row.id, marketRate: num(row.marketRate) });
  }
  const resolveProduct = async (code?: string | null) => {
    if (!code) return null;
    const hit = productByCode.get(code.toLowerCase());
    if (hit) return hit;
    const row = await prisma.product.create({
      data: { companyId: company.id, code, name: code, unit: 'MT', marketRate: 0 },
    });
    const v = { id: row.id, marketRate: 0 };
    productByCode.set(code.toLowerCase(), v);
    return v;
  };

  // ── Parties (master + any referenced by deals) ──────────────────────────────
  console.log(`▶ Parties (${data.parties.length})…`);
  const partyByName = new Map<string, string>();
  for (const p of data.parties) {
    const row = await prisma.party.upsert({
      where: { companyId_name: { companyId: company.id, name: p.name } },
      update: {},
      create: { companyId: company.id, name: p.name, type: p.type as any, city: p.city, phone: p.phone, notes: p.notes },
    });
    partyByName.set(p.name.toLowerCase(), row.id);
  }
  const resolveParty = async (name?: string | null) => {
    if (!name) return null;
    const key = name.toLowerCase();
    if (partyByName.has(key)) return partyByName.get(key)!;
    const row = await prisma.party.create({
      data: { companyId: company.id, name, type: 'BOTH' },
    });
    partyByName.set(key, row.id);
    return row.id;
  };

  // ── Self firm (the mandatory second party on every deal) ────────────────────
  console.log('▶ Self firm…');
  const selfFirm = await prisma.party.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Ojas Trading (Self)' } },
    update: { isSelf: true },
    create: { companyId: company.id, name: 'Ojas Trading (Self)', type: 'BOTH', isSelf: true, city: 'Kandla' },
  });

  // ── Deals (Direct + Degum) ──────────────────────────────────────────────────
  const existingDeals = await prisma.directDeal.count({ where: { companyId: company.id } });
  if (existingDeals === 0) {
    console.log(`▶ Direct Deals (${data.direct.length})…`);
    for (const d of data.direct) {
      const prod = await resolveProduct(d.material);
      const qty = num(d.quantity), rate = num(d.rate), marketRate = num(d.marketRate), brk = num(d.brokerageRate);
      await prisma.directDeal.create({
        data: {
          companyId: company.id, dealNo: d.dealNo, date: dOrNull(d.date) ?? new Date(),
          side: d.side, mainPartyId: await resolveParty(d.party), selfPartyId: selfFirm.id,
          productId: prod?.id ?? null,
          quantity: qty, rate, value: r4(qty * rate), marketRate, mtm: r4((marketRate - rate) * qty),
          brokerageRate: brk, brokerageTotal: r4(qty * brk),
          dueDate: dOrNull(d.dueDate), paymentStatus: d.paymentStatus, tankerNo: d.tankerNo,
          status: d.status, remarks: d.remarks,
          createdById: admin.id,
        },
      });
    }

    console.log(`▶ Degum Deals (${data.degum.length})…`);
    for (const d of data.degum) {
      const prod = await resolveProduct(d.material);
      const qty = num(d.quantity), buyRate = num(d.buyRate), sellRate = num(d.sellRate), brk = num(d.brokerageRate);
      const buyValue = r4(qty * buyRate), sellValue = r4(qty * sellRate);
      // Main party = the principal counterparty (seller preferred, else buyer).
      await prisma.degumDeal.create({
        data: {
          companyId: company.id, dealNo: d.dealNo, dealDate: dOrNull(d.dealDate),
          productId: prod?.id ?? null, shipmentMonth: d.shipmentMonth, originPort: d.originPort,
          mainPartyId: await resolveParty(d.seller ?? d.buyer), selfPartyId: selfFirm.id,
          quantity: qty, buyRate, sellRate, buyValue, sellValue, grossMargin: r4(sellValue - buyValue),
          brokerageRate: brk, brokerageTotal: r4(qty * brk),
          shipNameReceived: !!d.shipNameReceived, vessel: d.vessel,
          paymentDueDate: dOrNull(d.paymentDueDate), paymentStatus: d.paymentStatus, status: d.status,
          remarks: d.remarks, createdById: admin.id,
        },
      });
    }

    // advance number sequences past seeded deal numbers
    await prisma.numberSequence.upsert({
      where: { companyId_key: { companyId: company.id, key: 'DIRECT' } },
      update: { nextValue: data.direct.length + 1 },
      create: { companyId: company.id, key: 'DIRECT', prefix: 'DD', padding: 3, resetYearly: false, nextValue: data.direct.length + 1 },
    });
    await prisma.numberSequence.upsert({
      where: { companyId_key: { companyId: company.id, key: 'DEGUM' } },
      update: { nextValue: data.degum.length + 1 },
      create: { companyId: company.id, key: 'DEGUM', prefix: 'DG', padding: 3, resetYearly: false, nextValue: data.degum.length + 1 },
    });
  } else {
    console.log('▶ Deals already present — skipping deal seed.');
  }

  console.log('\n✅ Seed complete.');
  console.log(`   Company : ${company.name}`);
  console.log(`   Login   : ${adminEmail} / ${adminPassword}`);
  const partyTotal = await prisma.party.count({ where: { companyId: company.id } });
  console.log(`   Parties : ${partyTotal}  Products : ${data.products.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
