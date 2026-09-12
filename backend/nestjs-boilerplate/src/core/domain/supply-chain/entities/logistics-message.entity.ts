import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'logistics_messages' })
export class LogisticsMessageEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 }) id: string;
  @Column({ type: 'varchar', length: 50, name: 'conversation_id' }) conversationId: string;
  @Column({ type: 'varchar', length: 30, name: 'sender_role' }) senderRole: 'PARTNER' | 'PROCUREMENT' | 'SYSTEM';
  @Column({ type: 'text' }) body: string;
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' }) createdAt: Date;
}
