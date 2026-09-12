import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appConfig } from './infrastructure/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule, AuthModule, SupplyChainModule } from './infrastructure/api/module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    // connect TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        ssl: configService.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
        entities: [__dirname + '/core/domain/**/*.entity{.ts,.js}'], //auto load entities
        synchronize: false,
        logging: true,
      }),
    }),
    UsersModule,
    AuthModule,
    SupplyChainModule,
  ],
})
export class AppModule { }
