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

  @Column({ name: 'male_count', type: 'int', default: 0 })
  maleCount: number;

  @Column({ name: 'female_count', type: 'int', default: 0 })
  femaleCount: number;

  @Column({ name: 'total_count', type: 'int', default: 0 })
  totalCount: number;

  @Column({ name: 'gender_ratio', type: 'float', default: 0 })
  genderRatio: number;

  @Column({ name: 'dominant_gender', type: 'varchar', length: 1, nullable: true })
  dominantGender: string | null;

  @Column({ name: 'birth_years', type: 'jsonb', default: [] })
  birthYears: any[];

  @Column({ name:  'estimated_age', type: 'int', nullable: true })
  estimatedAge: number | null;

  @Column({ name: 'age_p25', type: 'int', nullable: true })
  ageP25: number | null;

  @Column({ name: 'age_p50', type: 'int', nullable: true })
  ageP50: number | null;

  @Column({ name:  'age_p75', type: 'int', nullable: true })
  ageP75: number | null;

  @Column({ name: 'peak_decade', type: 'varchar', nullable: true })  // ✅ FIX ICI
  peakDecade:  string | null;

  @Column({ default: 'insee' })
  source: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}