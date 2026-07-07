import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../common/types/request-user';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string; // user id
  companyId: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  /** Runs on every authenticated request; hydrates roles + permissions. */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.authService.buildRequestUser(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer active');
    return user;
  }
}
