import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { configValidationSchema } from 'config/schema.config'
import { LoggerMiddleWare } from 'middleware/logger.middleware'

import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard } from './auth/guards/jwt.guard'
import { DatabaseModule } from './database/database.module'
import { OrdersModule } from './orders/orders.module'
import { PermissionsGuard } from './permissions/guards/permissions.guard'
import { PermissionsModule } from './permissions/permissions.module'
import { ProductsModule } from './products/products.module'
import { RolesModule } from './roles/roles.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.STAGE}`],
      validationSchema: configValidationSchema,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    ProductsModule,
    OrdersModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleWare).forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
