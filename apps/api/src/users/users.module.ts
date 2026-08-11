import { Module } from '@nestjs/common';

import { UsersController } from './users.controller.js';
import { RolesController } from './roles.controller.js';
import { UsersService } from './users.service.js';
import { PrismaUsersRepository } from './prisma-users.repository.js';
import { usersRepositoryToken } from './users.repository.js';
import { AuthModule } from '../auth/auth.module.js';

const repositoryProvider = {
  provide: usersRepositoryToken,
  useClass: PrismaUsersRepository,
};

@Module({
  imports: [AuthModule],
  controllers: [UsersController, RolesController],
  providers: [UsersService, repositoryProvider],
})
export class UsersModule {}
