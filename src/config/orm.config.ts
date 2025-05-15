import { ConfigService } from '@nestjs/config'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js'

type ConfigType = TypeOrmModuleOptions & PostgresConnectionOptions
type ConnectionOptions = ConfigType

export const ORMConfig = async (ConfigService: ConfigService): Promise<ConnectionOptions> => ({
  type: 'postgres',
  host: ConfigService.get('DATABASE_HOST'),
  port: ConfigService.get('DATABASE_PORT'),
  username: ConfigService.get('DATABASE_USERNAME'),
  password: ConfigService.get('DATABASE_PWD'),
  database: ConfigService.get('DATABASE_NAME'),
  entities: ['dist/**/*.entity.js'],
  synchronize: true, //only in the development because if we put it in production everything in our database can be changed
  ssl: false,
  extra: {
    ssl: {
      rejectUnauthorized: false,
    },
  },
})
