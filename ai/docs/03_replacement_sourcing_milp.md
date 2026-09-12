# 03. ĐẮC TẢ THUẬT TOÁN TỐI ƯU HÓA PROPOSALS & RANKINGS (SOURCING PROPOSALS & MILP)

## 1. Chuẩn Hóa Phân Hệ Đề Xuất & Phê Duyệt (`SourcingProposalDto` / `ProposalRankingDto`)

Khi sự cố xảy ra (bản ghi `incidents` ở trạng thái `PENDING_APPROVAL` vượt ngưỡng rủi ro 65/100), **AI Background Worker** tự động chạy **PuLP MILP Solver** kết hợp **OpenAI GPT-4o** để tìm kiếm, tối ưu hóa và lưu danh sách xếp hạng phương án thay thế trực tiếp vào bảng `sourcing_proposals` trong Supabase PostgreSQL.

```
[ AI Worker: Phát hiện Incident PENDING_APPROVAL vượt ngưỡng (order_risk_scan) ]
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. SEARCH REPLACEMENT CANDIDATES (Suppliers Directory & SKU Capability) │
│ - Lọc các nhà cung ứng có capability sản xuất cùng mã SKU/HS Code      │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. PU LP MILP OPTIMIZATION SOLVER (Module Tối Ưu Hóa Toán Học)         │
│ - Tối ưu hóa đa tiêu chí: Đơn giá, Lead-time, Độ uy tín                │
│ - Tính điểm tổng hợp Score_i và xếp hạng Top 1, Top 2, Top 3           │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. OPENAI GPT-4O REASONING & PROS/CONS GENERATOR                       │
│ - Sinh mảng Pros & Cons tự động bằng GPT-4o Structured Output          │
│ - Ghi trực tiếp vào bảng sourcing_proposals (cột rankings & JSONB)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mô Hình Toán Học Đa Tiêu Chí Cho PuLP MILP Solver

Thuật toán tính điểm xếp hạng `score` ($0 - 100$) cho nhà cung ứng thay thế $i$:

$$\text{Score}_i = \text{round}\left( 0.45 \cdot \text{CostScore}_i + 0.35 \cdot \text{LeadTimeScore}_i + 0.20 \cdot \text{ReliabilityScore}_i \right)$$

### 2.1 Thành phần 1: Điểm Chi Phí ($\text{CostScore}_i$)
$$\text{CostScore}_i = \max\left(0.0, \min\left(100.0, 100.0 - \frac{\text{UnitPrice}_i - \text{OriginalUnitPrice}}{\text{OriginalUnitPrice}} \cdot 100.0\right)\right)$$

### 2.2 Thành phần 2: Điểm Thời Gian Giao Hàng ($\text{LeadTimeScore}_i$)
$$\text{LeadTimeScore}_i = \max\left(0.0, \min\left(100.0, 100.0 - \frac{\text{LeadTimeDays}_i}{\text{MaxLeadTimeAllowed}} \cdot 100.0\right)\right)$$

### 2.3 Thành phần 3: Điểm Uy Tín lịch sử ($\text{ReliabilityScore}_i$)
$$\text{ReliabilityScore}_i = \text{reliabilityScore từ SupplierDto}$$

---

## 3. Quy Trình OpenAI GPT-4o Structured Output Cho Pros/Cons/Reasoning

Dữ liệu sau khi qua MILP Solver sẽ được đưa vào OpenAI `gpt-4o` với Pydantic Response Format để tạo dữ liệu dạng JSON chuẩn DTO:

### 3.1 Pydantic Output Schema Trong Python:
```python
from pydantic import BaseModel, Field
from typing import List

class ProposalRankingItem(BaseModel):
    rank: int = Field(description="Thứ hạng xếp loại 1, 2, 3")
    supplierId: str = Field(description="Mã nhà cung cấp")
    supplierName: str = Field(description="Tên nhà cung cấp")
    unitPrice: float = Field(description="Đơn giá sản phẩm VNĐ")
    totalCost: float = Field(description="Tổng chi phí đơn hàng VNĐ")
    leadTimeDays: int = Field(description="Thời gian giao hàng tính bằng ngày")
    pros: List[str] = Field(description="Danh sách các ưu điểm nổi bật (1-3 ý)")
    cons: List[str] = Field(description="Danh sách các nhược điểm hoặc rủi ro (1-3 ý)")
    score: int = Field(description="Điểm tổng hợp 0-100")
    reasoning: str = Field(description="Diễn giải chi tiết lý do xếp hạng phương án này")

class SourcingProposalResponse(BaseModel):
    id: str
    incidentId: str
    poNumber: str
    sku: str
    rankings: List[ProposalRankingItem]
    recommendation: str = Field(description="Kết luận đề xuất súc tích gửi Quản lý")
    rejectedOptionsAnalysis: List[dict]
    totalValueVND: float
```

---

## 4. Mẫu Cấu Trúc Dữ Liệu Trong Bảng `sourcing_proposals`

```json
{
  "success": true,
  "data": {
    "id": "PROP-2026-001",
    "incidentId": "INC-2026-001",
    "correlationId": "CORR-PO-2026-003-8841",
    "poNumber": "PO-2026-003",
    "sku": "SKU-BRK-03",
    "skuName": "Bộ phanh đĩa thủy lực 2 piston",
    "quantity": 80,
    "originalSupplierName": "Công ty TNHH Phanh & Thủy lực Á Châu",
    "originalUnitPrice": 930000,
    "originalTotalCost": 74400000,
    "rankings": [
      {
        "rank": 1,
        "supplierId": "SUP-05",
        "supplierName": "Tập đoàn Cơ khí Động lực Mekong (Mekong Dynamics)",
        "unitPrice": 960000,
        "totalCost": 76800000,
        "leadTimeDays": 5,
        "pros": [
          "Giao hàng siêu tốc trong 5 ngày bù đắp ngay hàng trễ",
          "Điểm độ tin cậy lịch sử cao (85/100)"
        ],
        "cons": [
          "Giá đơn vị tăng nhẹ 3.2% so với giá hợp đồng cũ"
        ],
        "score": 91,
        "reasoning": "Phương án tối ưu tốt nhất giúp nhà máy tiếp tục lắp ráp không bị dừng chuyền."
      },
      {
        "rank": 2,
        "supplierId": "SUP-02",
        "supplierName": "Công ty TNHH Linh kiện Ô tô Đông Nam",
        "unitPrice": 940000,
        "totalCost": 75200000,
        "leadTimeDays": 8,
        "pros": [
          "Chi phí tiết kiệm hơn 1.6 triệu VNĐ so với phương án 1",
          "Khuôn đúc chuẩn 100%"
        ],
        "cons": [
          "Thời gian giao hàng 8 ngày kéo sát ngưỡng cạn tồn kho an toàn"
        ],
        "score": 84,
        "reasoning": "Giá tốt hơn nhưng rủi ro độ trễ cao hơn 3 ngày so với Mekong Dynamics."
      }
    ],
    "selectedRank": 1,
    "recommendation": "Kiến nghị duyệt Mekong Dynamics (Tổng trị giá 76.800.000 VNĐ).",
    "rejectedOptionsAnalysis": [
      {
        "supplierName": "VNJ Alloy (SUP-01)",
        "reason": "Không có khả năng sản xuất loại phanh đĩa thủy lực 2 piston."
      }
    ],
    "status": "Chờ duyệt",
    "totalValueVND": 76800000,
    "isLiveAI": true
  }
}
```
