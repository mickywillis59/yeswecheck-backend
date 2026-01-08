import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('whitelist')
export class Whitelist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ['domain', 'email'],
  })
  @Index()
  type: 'domain' | 'email';

  @Column({ unique: true })
  @Index()
  value: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  addedBy: string; // User ID (on ajoutera la relation plus tard)

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
