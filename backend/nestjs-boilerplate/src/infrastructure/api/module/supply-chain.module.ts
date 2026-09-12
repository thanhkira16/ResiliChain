import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplyChainService } from '../../../core/application/supply-chain/supply-chain.service';
import {
  IncidentEntity,
  InventoryItemEntity,
  PurchaseOrderEntity,
  ShipmentEntity,
  ShipmentTrackingPointEntity,
  SourcingProposalEntity,
  SupplierEntity,
  RiskAlertEntity,
  LogisticsConversationEntity,
  LogisticsMessageEntity,
} from '../../../core/domain/supply-chain';
import { SupplyChainController } from '../controller/supply-chain.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierEntity, InventoryItemEntity, PurchaseOrderEntity, IncidentEntity, SourcingProposalEntity, ShipmentEntity, ShipmentTrackingPointEntity, RiskAlertEntity, LogisticsConversationEntity, LogisticsMessageEntity])],
  controllers: [SupplyChainController],
  providers: [SupplyChainService],
})
export class SupplyChainModule {}
