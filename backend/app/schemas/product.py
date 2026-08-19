from pydantic import BaseModel


class ProductBase(BaseModel):
    sku: str
    name: str
    name_ur: str | None = None
    category: str | None = None
    unit: str = "piece"
    cost_price: float = 0.0
    sale_price: float = 0.0
    min_stock_level: float = 0.0


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    name_ur: str | None = None
    category: str | None = None
    cost_price: float | None = None
    sale_price: float | None = None
    min_stock_level: float | None = None


class ProductOut(ProductBase):
    id: str
    current_stock: float

    class Config:
        from_attributes = True
