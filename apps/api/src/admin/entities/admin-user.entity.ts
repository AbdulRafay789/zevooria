import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminRole } from './admin-role.entity';
import { AdminSession } from './admin-session.entity';

@Entity({ name: 'zevooria_admin_users' })
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 200, name: 'full_name' })
  fullName!: string;

  /** Legacy display field; authorization uses RBAC roles. */
  @Column({ type: 'varchar', length: 40, default: 'admin' })
  role!: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => AdminSession, (session) => session.adminUser)
  sessions!: AdminSession[];

  @ManyToMany(() => AdminRole, (role) => role.users)
  @JoinTable({
    name: 'zevooria_admin_user_roles',
    joinColumn: { name: 'admin_user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: AdminRole[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
