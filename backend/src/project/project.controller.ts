import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, ParseIntPipe, UnauthorizedException, HttpCode, HttpStatus, Query, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../types';
import { ProjectConfiguration } from '../types';
import { ProjectResponseDto } from './dto/project-response.dto';

const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProjectController {
  constructor(private projectService: ProjectService) { }

  @Get()
  @ApiOperation({
    summary: 'Get all projects (Admin only)',
    description: 'Retrieve all project estimates from all users. Only accessible by admin users. Returns projects with customer contact information for follow-up.'
  })
  @ApiResponse({
    status: 200,
    description: 'List of all projects with customer details',
    type: [ProjectResponseDto]
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required'
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllProjects() {
    return this.projectService.findAll();
  }

  @Get('my-projects')
  @Public()
  @ApiOperation({
    summary: 'Get current user projects',
    description: 'Retrieve all project estimates created by the authenticated user or by email (for public users). Returns only projects belonging to the current user or matching email.'
  })
  @ApiQuery({
    name: 'email',
    required: false,
    description: 'Email address to search for projects (for public users without authentication)',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'List of user projects',
    type: [ProjectResponseDto]
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token or email'
  })
  async getMyProjects(@Request() req: any, @Query('email') email?: string) {
    // If authenticated user, get by userId
    const userId = req.user?.userId;
    if (userId) {
      return this.projectService.findByUserId(userId);
    }

    // For public users, get by email if provided
    if (email) {
      return this.projectService.findByEmail(email);
    }

    throw new UnauthorizedException('User ID or email is required');
  }

  @Get('check-name')
  @Public()
  @ApiOperation({
    summary: 'Check if project name exists',
    description: 'Check if a project with the given name already exists across all projects. Public endpoint - no authentication required.'
  })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Project name to check',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Returns true if project name exists, false otherwise',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Project name already exists' }
      }
    }
  })
  async checkProjectName(@Query('name') name: string) {
    const exists = await this.projectService.checkProjectNameExists(name);
    return {
      exists,
      message: exists ? 'This project already exists' : 'Project name is available'
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get project by ID',
    description: 'Retrieve detailed information about a specific project including all blocks and full chip configuration. Public endpoint - no authentication required.'
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Project ID',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Project details with blocks and configuration',
    type: ProjectResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  async getProjectById(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findById(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete project (Admin only)',
    description: 'Permanently delete a project and all associated data (blocks, full chip config). Only accessible by admin users. This action cannot be undone.'
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Project ID to delete',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Project deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Project deleted successfully'
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required'
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found'
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteProject(@Param('id', ParseIntPipe) id: number) {
    await this.projectService.delete(id);
    return { message: 'Project deleted successfully' };
  }
}

