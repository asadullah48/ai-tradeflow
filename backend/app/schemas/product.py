from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    name_ur: str | None = None
    category: str | None = None
    unit: Literal["piece", "dozen", "carton", "kg", "meter"] = "piece"
    cost_price: float = Field(default=0, ge=0, allow_inf_nan=False)
    sale_price: float = Field(default=0, ge=0, allow_inf_nan=False)
    min_stock_level: float = Field(default=0, ge=0, allow_inf_nan=False)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    name_ur: str | None = None
    category: str | None = None
    cost_price: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    sale_price: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    min_stock_level: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class ProductOut(ProductBase):
    id: str
    current_stock: float

    model_config = ConfigDict(from_attributes=True)
