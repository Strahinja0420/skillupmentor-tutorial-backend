import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { User } from 'entities/user.entity'
import Logging from 'library/Logging'
import { UsersService } from 'modules/users/users.service'
import { compareHash, hash } from 'utils/bcrypt'
import { RegisterUserDto } from './dto/register-user.dto'
import { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { UserData } from 'interfaces/user.interface'
import { CookieType, JwtType, TokenPayload } from 'interfaces/auth.interface'
import { PostgresErrorCode } from 'helpers/postgresErrorCode.enum'

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService)) private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    Logging.info('Validating user...')
    const user = await this.usersService.findBy({ email: email })
    if (user === undefined) {
      throw new BadRequestException('Invalid credentials.')
    }
    if (!(await compareHash(password, user.password))) {
      throw new BadRequestException('Invalid credentials.')
    }

    Logging.info('User is valid.')
    return user
  }

  async register(registerUserDto: RegisterUserDto): Promise<User> {
    const hashedPassword = await hash(registerUserDto.password)
    const user = await this.usersService.create({
      role_id: null,
      ...registerUserDto,
      password: hashedPassword,
    })
    return await this.usersService.create({
      role_id: null,
      ...registerUserDto,
      password: hashedPassword,
    })
    return user
  }

  async login(userFromRequest: User, res: Response): Promise<void> {
    const user = await this.usersService.findById(userFromRequest.id)
    const accessToken = await this.generateToken(user.id, user.email, JwtType.ACCESS_TOKEN)
    const accessTokenCookie = await this.generateCookie(accessToken, CookieType.ACCESS_TOKEN)
    const refreshToken = await this.generateToken(user.id, user.email, JwtType.ACCESS_TOKEN)
    const refreshTokenCookie = await this.generateCookie(refreshToken, CookieType.REFRESH_TOKEN)
    try {
      await this.updateRtHash(user.id, refreshToken)
      res.setHeader(`Set-Cookie`, [accessTokenCookie, refreshTokenCookie]).json({ ...user })
    } catch (error) {
      Logging.error(error)
      throw new InternalServerErrorException('Something went wrong while setting cookies into response header')
    }
  }

  async signout(userId: string, res: Response): Promise<void> {
    const user = await this.usersService.findById(userId)
    await this.usersService.update(user.id, { refresh_token: null })
    try {
      res.setHeader('Set-Cookie', this.getCookiesForSignOut()).sendStatus(200)
    } catch (error) {
      Logging.error(error)
      throw new InternalServerErrorException('Something went wrong while setting cookies into response header')
    }
  }

  async refreshTokens(req: Request): Promise<User> {
    const user = await this.usersService.findBy({ refresh_token: req.cookies.refresh_token })
    if (!user) {
      throw new ForbiddenException()
    }
    try {
      await this.jwtService.verifyAsync(user.refresh_token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      })
    } catch (error) {
      Logging.error(error)
      throw new UnauthorizedException('Something went wrong while refreshing tokens')
    }

    const token = await this.generateToken(user.id, user.email, JwtType.ACCESS_TOKEN)
    const cookie = await this.generateCookie(token, CookieType.ACCESS_TOKEN)

    try {
      req.res.setHeader('Set-Cookie', cookie)
    } catch (error) {
      Logging.error(error)
      throw new InternalServerErrorException('Something went wrong while setting cookie into response header')
    }
    return user
  }

  async updateRtHash(userId: string, rt: string): Promise<void> {
    try {
      await this.usersService.update(userId, { refresh_token: rt })
    } catch (error) {
      Logging.error(error)
      throw new InternalServerErrorException('Somthing went wrong while updating user refresh token')
    }
  }

  async generateJWT(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, name: user.email })
  }

  async user(cookie: string): Promise<User> {
    const data = await this.jwtService.verifyAsync(cookie)
    return this.usersService.findById(data['id'])
  }

  async getUserId(request: Request): Promise<string> {
    const user = request.user as User
    return user.id
  }

  async getUserIfRefreshTokenMatches(refreshToken: string, userId: string): Promise<UserData> {
    const user = await this.usersService.findById(userId)
    const isRefreshTokenMatching = await compareHash(refreshToken, user.refresh_token)
    if (isRefreshTokenMatching) {
      return {
        id: user.id,
        email: user.email,
      }
    }
  }

  async generateToken(userId: string, email: string, type: JwtType): Promise<string> {
    try {
      const payload: TokenPayload = { sub: userId, name: email, type }
      let token: string
      switch (type) {
        case JwtType.ACCESS_TOKEN:
          token = await this.jwtService.signAsync(payload)
          break

        case JwtType.REFRESH_TOKEN:
          token = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: `${this.configService.get('JWT_REFRESH_SECRET_EXPIRES')}s`,
          })
          break
        default:
          throw new BadRequestException('Access denied')
      }
      return token
    } catch (error) {
      Logging.error(error)
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new BadRequestException('User with that email already exists')
      }
      throw new InternalServerErrorException('Something went wrong while generationg a new token')
    }
  }

  async generateCookie(token: string, type: CookieType): Promise<string> {
    try {
      let cookie: string
      switch (type) {
        case CookieType.REFRESH_TOKEN:
          cookie = `refresh_token=${token}; HttpOnly; Path=/; Max-Age=${this.configService.get(
            'JWT_SECRET_EXPIRES',
          )}; SameSite=strict`
          break
        case CookieType.ACCESS_TOKEN:
          cookie = `access_token=${token}; HttpOnly; Path=/; Max-Age=${this.configService.get(
            'JWT_REFRESH_SECRET_EXPIRES',
          )}; SameSite=strict`
          break
        default:
          throw new BadRequestException('Access denied')
      }
      return cookie
    } catch (error) {
      Logging.error(error)
      throw new InternalServerErrorException('Something went wrong while generationg a new cookie')
    }
  }

  getCookiesForSignOut(): string[] {
    return ['access_token=; HttpOnly; Path=/; Max-Age=0', 'refresh_token=; HttpOnly; Path=/; Max-Age=0']
  }
}
