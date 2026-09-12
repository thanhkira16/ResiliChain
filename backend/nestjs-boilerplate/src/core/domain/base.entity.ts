import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PRIMARY_KEY_COLUMN_NAME = 'id';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn({ name: PRIMARY_KEY_COLUMN_NAME })
  id: number;

  @CreateDateColumn({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at' 
  })
  createdAt: Date;

  @UpdateDateColumn({ 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    name: 'updated_at' 
  })
  updatedAt: Date;
}
