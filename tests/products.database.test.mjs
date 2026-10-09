import assert from 'node:assert/strict'
import { after,before,test } from 'node:test'
import { VertexiaDatabase } from '../electron-dist/electron/database/database.mjs'

let database
let product
const clock=()=>new Date('2026-10-08T12:00:00+05:00')

const draft=(changes={})=>({ name:'Premium Rice, 1kg',sku:'RICE-001',barcode:'9900011112222',category:'Grocery',subcategory:'Rice',brand:'Vertexia Foods',unit:'Kg',purchasePricePaisa:18_000,sellingPricePaisa:25_000,mrpPaisa:27_000,minimumStockMilli:5_000,openingStockMilli:20_000,status:'active',imageDataUrl:null,...changes })

before(()=>{database=new VertexiaDatabase(':memory:',clock);product=database.saveProduct('branch-main',draft())})
after(()=>database.close())

test('creates a complete product and opening stock movement',()=>{
  assert.equal(product.name,'Premium Rice, 1kg')
  assert.equal(product.stockMilli,20_000)
  assert.equal(product.minimumStockMilli,5_000)
  assert.equal(product.mrpPaisa,27_000)
  assert.equal(database.connection.prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id=?').get(product.id).count,1)
})

test('searches, filters and paginates the SQLite catalog',()=>{
  database.saveProduct('branch-main',draft({name:'Cola Bottle',sku:'COLA-001',barcode:'9900011113333',category:'Beverages',subcategory:'Soft Drinks',brand:'Fresh Cola'}))
  const search=database.listProducts({branchId:'branch-main',search:'RICE-001',category:'all',brand:'all',status:'all',page:1,pageSize:12})
  assert.equal(search.total,1)
  assert.equal(search.products[0].id,product.id)
  const category=database.listProducts({branchId:'branch-main',search:'',category:'Beverages',brand:'all',status:'active',page:1,pageSize:12})
  assert.equal(category.total,1)
  assert.deepEqual(category.categories,['Beverages','Grocery'])
  assert.deepEqual(category.brands,['Fresh Cola','Vertexia Foods'])
})

test('updates product details without silently changing stock',()=>{
  const updated=database.saveProduct('branch-main',draft({id:product.id,name:'Premium Basmati Rice',sellingPricePaisa:26_000,openingStockMilli:999_000}))
  assert.equal(updated.name,'Premium Basmati Rice')
  assert.equal(updated.sellingPricePaisa,26_000)
  assert.equal(updated.stockMilli,20_000)
})

test('enforces unique SKU and barcode constraints',()=>{
  assert.throws(()=>database.saveProduct('branch-main',draft({name:'Duplicate SKU',barcode:'9900011119999'})),/SKU already belongs/)
  assert.throws(()=>database.saveProduct('branch-main',draft({name:'Duplicate Barcode',sku:'RICE-NEW'})),/Barcode already belongs/)
})

test('activation status immediately controls POS visibility',()=>{
  assert.equal(database.toggleProductStatus('branch-main',product.id),'inactive')
  assert.equal(database.getPosBootstrap('branch-main').products.some(item=>item.id===product.id),false)
  assert.equal(database.listProducts({branchId:'branch-main',search:'',category:'all',brand:'all',status:'inactive',page:1,pageSize:12}).total,1)
  assert.equal(database.toggleProductStatus('branch-main',product.id),'active')
  assert.equal(database.getPosBootstrap('branch-main').products.some(item=>item.id===product.id),true)
})

test('imports CSV atomically with stock and rejects duplicate rows',()=>{
  const csv='name,sku,barcode,category,subcategory,brand,unit,purchase_price,sale_price,mrp,minimum_stock,opening_stock,status\r\n"Tea, Premium",TEA-001,9900011114444,Grocery,Tea,Good Tea,Pack,100,140,150,4,12,active\r\nSoap,SOAP-001,9900011115555,Personal Care,Soap,Clean,Piece,60,90,100,5,20,inactive'
  const imported=database.importProductsCsv('branch-main',csv)
  assert.equal(imported.imported,2)
  const tea=database.listProducts({branchId:'branch-main',search:'Tea, Premium',category:'all',brand:'all',status:'all',page:1,pageSize:12}).products[0]
  assert.equal(tea.stockMilli,12_000)
  assert.equal(tea.sellingPricePaisa,14_000)
  const before=database.connection.prepare('SELECT COUNT(*) AS count FROM products').get().count
  assert.throws(()=>database.importProductsCsv('branch-main','name,sku,barcode,category,unit,sale_price,opening_stock\nOne,DUP-1,777,Grocery,Piece,10,1\nTwo,DUP-1,778,Grocery,Piece,10,1'),/Duplicate SKU/)
  assert.equal(database.connection.prepare('SELECT COUNT(*) AS count FROM products').get().count,before)
})

test('exports every product with safe CSV quoting',()=>{
  const csv=database.exportProductsCsv('branch-main')
  assert.match(csv,/"Premium Basmati Rice"|Premium Basmati Rice/)
  assert.match(csv,/"Tea, Premium"/)
  assert.equal(csv.trim().split(/\r?\n/).length,5)
})

test('validates price, MRP and image constraints',()=>{
  assert.throws(()=>database.saveProduct('branch-main',draft({sku:'BAD-1',barcode:'BAD-1',sellingPricePaisa:0})),/greater than zero/)
  assert.throws(()=>database.saveProduct('branch-main',draft({sku:'BAD-2',barcode:'BAD-2',sellingPricePaisa:20_000,mrpPaisa:10_000})),/MRP cannot/)
  assert.throws(()=>database.saveProduct('branch-main',draft({sku:'BAD-3',barcode:'BAD-3',imageDataUrl:'https://example.com/image.jpg'})),/PNG or JPG/)
})
