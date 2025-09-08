import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './login/auth/auth.module';
import { UserModule } from './login/user/module/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/module/email.module';
import { FormsModule } from './forms/forms.module';
import { RolesGuard } from './login/auth/roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { LogsModule } from './log/logs.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '1d' },
      }),
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    EmailModule,
    FormsModule,
    DashboardModule,
    LogsModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
