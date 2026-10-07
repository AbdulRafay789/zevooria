import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminPermission } from './admin-permission.entity';
import { AdminUser } from './admin-user.entity';

@Entity({ name: 'zevooria_admin_roles' })
export class AdminRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @ManyToMany(() => AdminPermission, (permission) => permission.roles)
  @JoinTable({
    name: 'zevooria_admin_role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions!: AdminPermission[];

  @ManyToMany(() => AdminUser, (user) => user.roles)
  users!: AdminUser[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
