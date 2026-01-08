import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('role_patterns')
export class RolePattern {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  pattern: string; // Ex: "info", "contact", "support"

  @Column({ nullable: true })
  description: string; // Ex: "Information email"

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isCustom: boolean; // true si ajouté par user, false si built-in

  @Column({ nullable: true })
  addedBy: string; // User ID

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
