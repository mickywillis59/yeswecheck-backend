import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('profanity_words')
export class ProfanityWord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  word: string;

  @Column({ default: 'en' })
  @Index()
  language: string; // 'en', 'fr', 'es'... 

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  })
  severity: 'low' | 'medium' | 'high';

  @Column({ default: false })
  isCustom: boolean; // false = importé depuis liste externe, true = ajouté manuellement

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  category:  string; // 'sexual', 'violence', 'racist', 'general'... 

  @Column({ nullable: true })
  source: string; // 'ldnoobw', 'french-badwords', 'custom'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}