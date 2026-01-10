import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('insee_firstnames')
export class InseeFirstname {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  firstname: string;

  @Column({ type: 'int', default: 0 })
  maleCount: number;

  @Column({ type: 'int', default: 0 })
  femaleCount: number;

  @Column({ type: 'int', default: 0 })
  totalCount: number;

  @Column({ type: 'float', default: 0 })
  genderRatio: number;

  @Column({ type: 'char', length: 1, nullable: true })
  dominantGender: string;

  @Column({ type: 'jsonb', default: [] })
  birthYears: any[];

  @Column({ type: 'int', nullable: true })
  estimatedAge: number;

  @Column({ type: 'int', nullable: true })
  ageP25: number;

  @Column({ type: 'int', nullable: true })
  ageP50: number;

  @Column({ type: 'int', nullable: true })
  ageP75: number;

  @Column({ nullable: true })
  peakDecade: string;

  @Column({ default: 'insee' })
  source: string;

  @CreateDateColumn()
  createdAt: Date;
}
