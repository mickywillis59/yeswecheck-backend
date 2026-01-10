import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('ambiguous_firstnames')
export class AmbiguousFirstname {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  firstname: string;

  @Column({
    name: 'token_type',
    type: 'varchar',
    length: 20,
    default: 'AMBIGUOUS',
  })
  tokenType: 'AMBIGUOUS' | 'LASTNAME_ONLY';

  @Column({
    name: 'lastname_frequency',
    type: 'varchar',
    length: 20,
    default: 'high',
  })
  lastnameFrequency: 'high' | 'medium' | 'low';

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}