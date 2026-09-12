import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplyChainService } from '../../../core/application/supply-chain/supply-chain.service';
import {
  AiJobRunEntity,
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
  SupplierRiskAnalysisEntity,
} from '../../../core/domain/supply-chain';
import { SupplyChainController } from '../controller/supply-chain.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    SupplierEntity,
    InventoryItemEntity,
    PurchaseOrderEntity,
    IncidentEntity,
    SourcingProposalEntity,
    ShipmentEntity,
    ShipmentTrackingPointEntity,
    RiskAlertEntity,
    LogisticsConversationEntity,
    LogisticsMessageEntity,
    SupplierRiskAnalysisEntity,
    AiJobRunEntity,
  ])],
  controllers: [SupplyChainController],
  providers: [SupplyChainService],
})
export class SupplyChainModule {}
