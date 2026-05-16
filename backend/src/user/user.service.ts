import { Injectable, ConflictException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../types';
import { validateEmailDomain } from '../utils/email-domain.validator';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    // Initialize default users if they don't exist
    await this.initializeDefaultUsers();
  }

  private async initializeDefaultUsers() {
    const defaultUsers = [
      {
        name: 'Admin User',
        email: 'admin@rtlgds.com',
        passwordHash: 'admin123', // TODO: Hash password properly with bcrypt
        role: UserRole.ADMIN,
        isActive: true,
      },
      {
        name: 'Customer User',
        email: 'customer@rtlgds.com',
        passwordHash: 'customer123', // TODO: Hash password properly with bcrypt
        role: UserRole.CUSTOMER,
        isActive: true,
      },
    ];

    for (const defaultUser of defaultUsers) {
      const existingUser = await this.userRepository.findOne({
        where: { email: defaultUser.email },
      });
      if (!existingUser) {
        await this.userRepository.save(
          this.userRepository.create(defaultUser),
        );
      }
    }
  }

  async create(name: string, email: string, password: string, role: UserRole): Promise<User> {
    // Validate email domain (blocks public providers, allows custom domains)
    validateEmailDomain(email);

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = this.userRepository.create({
      name,
      email,
      passwordHash: password, // TODO: Hash password properly with bcrypt before storing
      role,
      isActive: true,
    });

    return await this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt'], // Exclude passwordHash
    });
  }

  async update(id: number, updates: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, updates);
    return await this.userRepository.save(user);
  }

  async delete(id: number): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }
}
