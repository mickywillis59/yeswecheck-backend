import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('disposable_domains')
export class DisposableDomain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  domain: string;

  @Column({ nullable: true })
  provider: string; // Nom du provider (ex: "10minutemail", "guerrillamail")

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isCustom: boolean; // true si ajouté manuellement, false si built-in

  @Column({ nullable: true })
  addedBy: string; // User ID

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
