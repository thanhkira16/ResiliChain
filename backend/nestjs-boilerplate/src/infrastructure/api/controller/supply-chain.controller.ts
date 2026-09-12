import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupplyChainService } from '../../../core/application/supply-chain/supply-chain.service';
import {
  IncidentEntity,
  PurchaseOrderEntity,
  ShipmentTrackingPointEntity,
  SourcingProposalEntity,
} from '../../../core/domain/supply-chain';

@ApiTags('Supply chain')
@Controller('supply-chain')
export class SupplyChainController {
  constructor(private readonly supplyChainService: SupplyChainService) {}

  @Get('suppliers') findSuppliers() { return this.supplyChainService.findSuppliers(); }
  @Get('inventory') findInventory() { return this.supplyChainService.findInventory(); }
  @Get('purchase-orders') findPurchaseOrders() { return this.supplyChainService.findPurchaseOrders(); }
  @Post('purchase-orders') createPurchaseOrder(@Body() body: Record<string, unknown>) { return this.supplyChainService.createPurchaseOrder(body as unknown as PurchaseOrderEntity); }
  @Patch('purchase-orders/:id') updatePurchaseOrder(@Param('id') id: string, @Body() body: Partial<PurchaseOrderEntity>) { return this.supplyChainService.updatePurchaseOrder(id, body); }
  @Get('incidents') findIncidents() { return this.supplyChainService.findIncidents(); }
  @Post('incidents') createIncident(@Body() body: Record<string, unknown>) { return this.supplyChainService.createIncident(body as unknown as IncidentEntity); }
  @Patch('incidents/:id') updateIncident(@Param('id') id: string, @Body() body: Partial<IncidentEntity>) { return this.supplyChainService.updateIncident(id, body); }
  @Get('sourcing-proposals') findProposals() { return this.supplyChainService.findProposals(); }
  @Post('sourcing-proposals') createProposal(@Body() body: Record<string, unknown>) { return this.supplyChainService.createProposal(body as unknown as SourcingProposalEntity); }
  @Patch('sourcing-proposals/:id') updateProposal(@Param('id') id: string, @Body() body: Partial<SourcingProposalEntity>) { return this.supplyChainService.updateProposal(id, body); }
  @Get('supplier-risk') findSupplierRisk() { return this.supplyChainService.findSupplierRisk(); }
  @Get('ai-job-runs') findAiJobRuns(@Query('limit') limit?: string) { return this.supplyChainService.findAiJobRuns(limit ? Number(limit) : undefined); }
  @Get('shipments/at-risk-map') atRiskShipments() { return this.supplyChainService.atRiskShipments(); }
  @Post('shipment-tracking-points') recordTrackingPoint(@Body() body: Record<string, unknown>) { return this.supplyChainService.recordTrackingPoint(body as unknown as ShipmentTrackingPointEntity); }
}
