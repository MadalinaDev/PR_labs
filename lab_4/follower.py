import os
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
store = {}

class Item(BaseModel):
    key: str
    value: str

@app.post("/replicate")
async def replicate(item: Item):
    store[item.key] = item.value
    return {"status": "ok"}

@app.get("/get/{key}")
async def get_value(key: str):
    return {"key": key, "value": store.get(key, None)}
