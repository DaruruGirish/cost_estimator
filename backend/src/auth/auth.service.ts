import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { UserRole } from '../types';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async register(name: string, email: string, password: string, role: UserRole) {
    // Create user in database (UserService handles conflict check)
    const newUser = await this.userService.create(name, email, password, role);

    // Return JWT token immediately after registration
    const payload = { 
      email: newUser.email, 
      role: newUser.role, 
      sub: newUser.email,
      userId: newUser.id 
    };
    return {
      access_token: this.jwtService.sign(payload),
      role: newUser.role,
      email: newUser.email,
      name: newUser.name,
    };
  }

  async login(email: string, password: string) {
    // Find user by email in database
    const user = await this.userService.findByEmail(email);
    
    // Additional validation: ensure email is not empty
    if (!email || email.trim() === '') {
      throw new UnauthorizedException('Email is required');
    }
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    
    // TODO: Compare password hash using bcrypt
    if (user.passwordHash !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { 
      email: user.email, 
      role: user.role, 
      sub: user.email,
      userId: user.id 
    };
    return {
      access_token: this.jwtService.sign(payload),
      role: user.role,
      email: user.email,
      name: user.name,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    // TODO: Compare password hash using bcrypt
    if (user && user.isActive && user.passwordHash === password) {
      return { email: user.email, role: user.role };
    }
    return null;
  }
}
