const db = uniCloud.database()
const dbCmd = db.command

const PAGE_SIZE_MAX = 50

function ok(data = {}) {
	return {
		errCode: 0,
		errMsg: 'success',
		data
	}
}

function fail(errCode, errMsg) {
	return {
		errCode,
		errMsg
	}
}

function now() {
	return Date.now()
}

function isPlainObject(value) {
	return Object.prototype.toString.call(value) === '[object Object]'
}

function trimString(value) {
	return typeof value === 'string' ? value.trim() : ''
}

function normalizePage(params = {}) {
	const page = Number(params.page || 1)
	const pageSize = Number(params.pageSize || 10)
	if (!Number.isInteger(page) || page < 1) {
		throw new Error('INVALID_PAGE')
	}
	if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE_MAX) {
		throw new Error('INVALID_PAGE_SIZE')
	}
	return { page, pageSize }
}

function validateId(id, field = 'id') {
	const value = trimString(id)
	if (!value || value.length > 128) {
		throw new Error(`INVALID_${field.toUpperCase()}`)
	}
	return value
}

function validateString(value, field, maxLength, required = true) {
	const str = trimString(value)
	if (required && !str) {
		throw new Error(`INVALID_${field.toUpperCase()}`)
	}
	if (str.length > maxLength) {
		throw new Error(`INVALID_${field.toUpperCase()}`)
	}
	return str
}

function validateNumber(value, field, min = 0, max = Number.MAX_SAFE_INTEGER) {
	const num = Number(value)
	if (!Number.isFinite(num) || num < min || num > max) {
		throw new Error(`INVALID_${field.toUpperCase()}`)
	}
	return num
}

function getOpenId(context) {
	return context && context.OPENID ? context.OPENID : ''
}

async function listActive(collection, options = {}) {
	const where = Object.assign({ status: 1 }, options.where || {})
	const field = options.field || {}
	const orderBy = options.orderBy || 'sort asc,create_time desc'
	let query = db.collection(collection).where(where)
	if (Object.keys(field).length) {
		query = query.field(field)
	}
	if (orderBy) {
		orderBy.split(',').forEach(item => {
			const parts = item.trim().split(/\s+/)
			if (parts[0]) query = query.orderBy(parts[0], parts[1] === 'asc' ? 'asc' : 'desc')
		})
	}
	if (options.skip) query = query.skip(options.skip)
	if (options.limit) query = query.limit(options.limit)
	const res = await query.get()
	return res.data || []
}

async function pageList(collection, params, where = {}, field = {}) {
	const { page, pageSize } = normalizePage(params)
	const finalWhere = Object.assign({ status: 1 }, where)
	let query = db.collection(collection).where(finalWhere)
	if (Object.keys(field).length) query = query.field(field)
	const countRes = await db.collection(collection).where(finalWhere).count()
	const listRes = await query.orderBy('sort', 'asc').orderBy('create_time', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()
	return {
		list: listRes.data || [],
		page,
		pageSize,
		total: countRes.total || 0
	}
}

async function getDetail(collection, id) {
	const _id = validateId(id)
	const res = await db.collection(collection).doc(_id).get()
	const data = res.data && res.data[0]
	if (!data || data.status !== 1) {
		throw new Error('NOT_FOUND')
	}
	return data
}

async function createUserRecord(collection, openid, payload) {
	const time = now()
	const res = await db.collection(collection).add(Object.assign({}, payload, {
		openid,
		status: 1,
		create_time: time,
		update_time: time
	}))
	return res.id
}

function needLogin(openid) {
	if (!openid) throw new Error('LOGIN_REQUIRED')
}

function handleError(error) {
	const code = error && error.message ? error.message : 'INTERNAL_ERROR'
	const messageMap = {
		INVALID_PAGE: '分页页码不合法',
		INVALID_PAGE_SIZE: '分页大小不合法',
		NOT_FOUND: '数据不存在',
		LOGIN_REQUIRED: '请先登录',
		CART_EMPTY: '购物车为空',
		ORDER_ITEM_EMPTY: '订单商品不能为空',
		INTERNAL_ERROR: '服务器异常'
	}
	if (code.indexOf('INVALID_') === 0 && !messageMap[code]) {
		return fail(code, '参数不合法')
	}
	return fail(messageMap[code] ? code : 'INTERNAL_ERROR', messageMap[code] || messageMap.INTERNAL_ERROR)
}

module.exports = {
	_before: function () {
		this.openid = getOpenId(this.getClientInfo())
	},

	async getHome() {
		try {
			const [entrances, advantages, recommends, notices] = await Promise.all([
				listActive('zy_services', { where: { scene: 'home_entrance' }, limit: 10 }),
				listActive('zy_services', { where: { scene: 'home_advantage' }, limit: 10 }),
				listActive('zy_services', { where: { scene: 'home_recommend' }, limit: 10 }),
				listActive('zy_banners', { where: { position: 'notice' }, limit: 5 })
			])
			return ok({ entrances, advantages, recommends, notices })
		} catch (error) {
			return handleError(error)
		}
	},

	async getServiceHome() {
		try {
			const categories = await listActive('zy_service_categories', { limit: 20 })
			const categoryIds = categories.map(item => item._id)
			const services = categoryIds.length
				? await listActive('zy_services', { where: { category_id: dbCmd.in(categoryIds) }, limit: 100 })
				: []
			const serviceMap = services.reduce((map, item) => {
				if (!map[item.category_id]) map[item.category_id] = []
				map[item.category_id].push(item)
				return map
			}, {})
			return ok({
				categories: categories.map(item => Object.assign({}, item, { items: serviceMap[item._id] || [] }))
			})
		} catch (error) {
			return handleError(error)
		}
	},

	async getServiceDetail(params = {}) {
		try {
			return ok({ detail: await getDetail('zy_services', params.id) })
		} catch (error) {
			return handleError(error)
		}
	},

	async submitConsult(params = {}) {
		try {
			const openid = this.openid || ''
			const payload = {
				biz_type: validateString(params.bizType || 'service', 'bizType', 32),
				ref_id: validateString(params.refId || '', 'refId', 128, false),
				name: validateString(params.name || '微信用户', 'name', 30),
				phone: validateString(params.phone, 'phone', 20),
				content: validateString(params.content, 'content', 500, false)
			}
			const id = await createUserRecord('zy_consults', openid, payload)
			return ok({ id })
		} catch (error) {
			return handleError(error)
		}
	},

	async getMallHome(params = {}) {
		try {
			const keyword = validateString(params.keyword || '', 'keyword', 50, false)
			const productWhere = keyword ? { name: new RegExp(keyword, 'i') } : {}
			const [categories, banners, guarantees, products, flashProducts] = await Promise.all([
				listActive('zy_product_categories', { limit: 20 }),
				listActive('zy_banners', { where: { position: 'mall' }, limit: 5 }),
				listActive('zy_services', { where: { scene: 'mall_guarantee' }, limit: 10 }),
				listActive('zy_products', { where: productWhere, limit: 20 }),
				listActive('zy_products', { where: Object.assign({ is_flash: true }, productWhere), limit: 6 })
			])
			return ok({ categories, banners, guarantees, products, flashProducts })
		} catch (error) {
			return handleError(error)
		}
	},

	async getCategoryProducts(params = {}) {
		try {
			const where = {}
			const categoryId = validateString(params.categoryId || '', 'categoryId', 128, false)
			const keyword = validateString(params.keyword || '', 'keyword', 50, false)
			if (categoryId) where.category_id = categoryId
			if (keyword) where.name = new RegExp(keyword, 'i')
			return ok(await pageList('zy_products', params, where))
		} catch (error) {
			return handleError(error)
		}
	},

	async getProductDetail(params = {}) {
		try {
			const detail = await getDetail('zy_products', params.id)
			if (this.openid) {
				await createUserRecord('zy_browse_history', this.openid, {
					biz_type: 'product',
					ref_id: detail._id,
					title: detail.name || '',
					image: detail.image || ''
				})
			}
			return ok({ detail })
		} catch (error) {
			return handleError(error)
		}
	},

	async addCart(params = {}) {
		try {
			needLogin(this.openid)
			const productId = validateId(params.productId, 'productId')
			const quantity = validateNumber(params.quantity || 1, 'quantity', 1, 999)
			const product = await getDetail('zy_products', productId)
			const existed = await db.collection('zy_cart_items').where({
				openid: this.openid,
				product_id: productId,
				status: 1
			}).limit(1).get()
			const time = now()
			if (existed.data && existed.data.length) {
				const item = existed.data[0]
				await db.collection('zy_cart_items').doc(item._id).update({
					quantity: Number(item.quantity || 0) + quantity,
					update_time: time
				})
				return ok({ id: item._id })
			}
			const id = await createUserRecord('zy_cart_items', this.openid, {
				product_id: productId,
				product_snapshot: product,
				quantity
			})
			return ok({ id })
		} catch (error) {
			return handleError(error)
		}
	},

	async getCart() {
		try {
			needLogin(this.openid)
			const list = await listActive('zy_cart_items', { where: { openid: this.openid }, limit: 100 })
			const totalAmount = list.reduce((sum, item) => {
				const price = Number(item.product_snapshot && item.product_snapshot.price || 0)
				return sum + price * Number(item.quantity || 0)
			}, 0)
			return ok({ list, totalAmount })
		} catch (error) {
			return handleError(error)
		}
	},

	async removeCartItem(params = {}) {
		try {
			needLogin(this.openid)
			const id = validateId(params.id)
			await db.collection('zy_cart_items').where({ _id: id, openid: this.openid }).update({
				status: 0,
				update_time: now()
			})
			return ok()
		} catch (error) {
			return handleError(error)
		}
	},

	async createOrder(params = {}) {
		try {
			needLogin(this.openid)
			const items = Array.isArray(params.items) ? params.items : []
			if (!items.length) throw new Error('ORDER_ITEM_EMPTY')
			const checkedItems = []
			for (const item of items) {
				if (!isPlainObject(item)) throw new Error('ORDER_ITEM_EMPTY')
				const product = await getDetail('zy_products', item.productId)
				checkedItems.push({
					product_id: product._id,
					product_snapshot: product,
					quantity: validateNumber(item.quantity || 1, 'quantity', 1, 999)
				})
			}
			const amount = checkedItems.reduce((sum, item) => sum + Number(item.product_snapshot.price || 0) * item.quantity, 0)
			const id = await createUserRecord('zy_orders', this.openid, {
				order_no: `${now()}${Math.floor(Math.random() * 1000)}`,
				order_type: validateString(params.orderType || 'mall', 'orderType', 32),
				items: checkedItems,
				address_id: validateString(params.addressId || '', 'addressId', 128, false),
				remark: validateString(params.remark || '', 'remark', 300, false),
				amount,
				pay_amount: amount,
				order_status: 'pending_pay'
			})
			return ok({ id })
		} catch (error) {
			return handleError(error)
		}
	},

	async getOrderList(params = {}) {
		try {
			needLogin(this.openid)
			const orderStatus = validateString(params.orderStatus || '', 'orderStatus', 32, false)
			const where = { openid: this.openid }
			if (orderStatus) where.order_status = orderStatus
			return ok(await pageList('zy_orders', params, where))
		} catch (error) {
			return handleError(error)
		}
	},

	async getOrderDetail(params = {}) {
		try {
			needLogin(this.openid)
			const id = validateId(params.id)
			const res = await db.collection('zy_orders').where({ _id: id, openid: this.openid, status: 1 }).limit(1).get()
			const detail = res.data && res.data[0]
			if (!detail) throw new Error('NOT_FOUND')
			return ok({ detail })
		} catch (error) {
			return handleError(error)
		}
	},

	async payOrderMock(params = {}) {
		try {
			needLogin(this.openid)
			const id = validateId(params.id)
			await db.collection('zy_orders').where({ _id: id, openid: this.openid, status: 1 }).update({
				order_status: 'paid',
				pay_time: now(),
				update_time: now()
			})
			return ok()
		} catch (error) {
			return handleError(error)
		}
	},

	async getActivityHome(params = {}) {
		try {
			const activityStatus = validateString(params.activityStatus || '', 'activityStatus', 32, false)
			const category = validateString(params.category || '', 'category', 50, false)
			const keyword = validateString(params.keyword || '', 'keyword', 50, false)
			const where = {}
			if (activityStatus) where.activity_status = activityStatus
			if (category) where.category = category
			if (keyword) where.title = new RegExp(keyword, 'i')
			const listData = await pageList('zy_activities', params, where)
			const categories = await listActive('zy_services', { where: { scene: 'activity_category' }, limit: 20 })
			return ok(Object.assign({ categories }, listData))
		} catch (error) {
			return handleError(error)
		}
	},

	async getActivityDetail(params = {}) {
		try {
			return ok({ detail: await getDetail('zy_activities', params.id) })
		} catch (error) {
			return handleError(error)
		}
	},

	async joinActivity(params = {}) {
		try {
			return this.submitConsult({
				bizType: 'activity',
				refId: params.activityId,
				name: params.name,
				phone: params.phone,
				content: params.remark || ''
			})
		} catch (error) {
			return handleError(error)
		}
	},

	async getCarHome(params = {}) {
		try {
			const keyword = validateString(params.keyword || '', 'keyword', 50, false)
			const where = keyword ? { title: new RegExp(keyword, 'i') } : {}
			const [brands, filters, cars] = await Promise.all([
				listActive('zy_services', { where: { scene: 'car_brand' }, limit: 50 }),
				listActive('zy_services', { where: { scene: 'car_filter' }, limit: 20 }),
				listActive('zy_cars', { where, limit: 10 })
			])
			return ok({ brands, filters, cars })
		} catch (error) {
			return handleError(error)
		}
	},

	async getCarList(params = {}) {
		try {
			const where = {}
			const brand = validateString(params.brand || '', 'brand', 50, false)
			const keyword = validateString(params.keyword || '', 'keyword', 50, false)
			if (brand) where.brand = brand
			if (keyword) where.title = new RegExp(keyword, 'i')
			return ok(await pageList('zy_cars', params, where))
		} catch (error) {
			return handleError(error)
		}
	},

	async getCarDetail(params = {}) {
		try {
			const detail = await getDetail('zy_cars', params.id)
			if (this.openid) {
				await createUserRecord('zy_browse_history', this.openid, {
					biz_type: 'car',
					ref_id: detail._id,
					title: detail.title || '',
					image: detail.image || ''
				})
			}
			return ok({ detail })
		} catch (error) {
			return handleError(error)
		}
	},

	async submitCarConsult(params = {}) {
		try {
			return this.submitConsult({
				bizType: 'car',
				refId: params.carId,
				name: params.name,
				phone: params.phone,
				content: params.content || ''
			})
		} catch (error) {
			return handleError(error)
		}
	},

	async getUserProfile() {
		try {
			needLogin(this.openid)
			const res = await db.collection('zy_profiles').where({ openid: this.openid, status: 1 }).limit(1).get()
			return ok({ profile: res.data && res.data[0] || {} })
		} catch (error) {
			return handleError(error)
		}
	},

	async saveUserProfile(params = {}) {
		try {
			needLogin(this.openid)
			const payload = {
				nickname: validateString(params.nickname || '', 'nickname', 30, false),
				avatar: validateString(params.avatar || '', 'avatar', 300, false),
				phone: validateString(params.phone || '', 'phone', 20, false),
				gender: validateString(params.gender || '', 'gender', 20, false),
				update_time: now()
			}
			const existed = await db.collection('zy_profiles').where({ openid: this.openid, status: 1 }).limit(1).get()
			if (existed.data && existed.data.length) {
				await db.collection('zy_profiles').doc(existed.data[0]._id).update(payload)
				return ok({ id: existed.data[0]._id })
			}
			const id = await createUserRecord('zy_profiles', this.openid, payload)
			return ok({ id })
		} catch (error) {
			return handleError(error)
		}
	},

	async getAddressList() {
		try {
			needLogin(this.openid)
			return ok({ list: await listActive('zy_addresses', { where: { openid: this.openid }, limit: 50 }) })
		} catch (error) {
			return handleError(error)
		}
	},

	async saveAddress(params = {}) {
		try {
			needLogin(this.openid)
			const payload = {
				name: validateString(params.name, 'name', 30),
				phone: validateString(params.phone, 'phone', 20),
				province: validateString(params.province || '', 'province', 30, false),
				city: validateString(params.city || '', 'city', 30, false),
				district: validateString(params.district || '', 'district', 30, false),
				address: validateString(params.address, 'address', 200),
				is_default: Boolean(params.isDefault),
				update_time: now()
			}
			if (payload.is_default) {
				await db.collection('zy_addresses').where({ openid: this.openid, status: 1 }).update({
					is_default: false,
					update_time: now()
				})
			}
			const id = validateString(params.id || '', 'id', 128, false)
			if (id) {
				await db.collection('zy_addresses').where({ _id: id, openid: this.openid }).update(payload)
				return ok({ id })
			}
			const newId = await createUserRecord('zy_addresses', this.openid, payload)
			return ok({ id: newId })
		} catch (error) {
			return handleError(error)
		}
	},

	async deleteAddress(params = {}) {
		try {
			needLogin(this.openid)
			const id = validateId(params.id)
			await db.collection('zy_addresses').where({ _id: id, openid: this.openid }).update({
				status: 0,
				update_time: now()
			})
			return ok()
		} catch (error) {
			return handleError(error)
		}
	},

	async submitFeedback(params = {}) {
		try {
			const payload = {
				feedback_type: validateString(params.type || '功能建议', 'type', 30),
				content: validateString(params.content, 'content', 1000),
				contact: validateString(params.contact || '', 'contact', 100, false)
			}
			const id = await createUserRecord('zy_feedback', this.openid || '', payload)
			return ok({ id })
		} catch (error) {
			return handleError(error)
		}
	},

	async getFavorites(params = {}) {
		try {
			needLogin(this.openid)
			const bizType = validateString(params.bizType || '', 'bizType', 30, false)
			const where = { openid: this.openid }
			if (bizType) where.biz_type = bizType
			return ok(await pageList('zy_favorites', params, where))
		} catch (error) {
			return handleError(error)
		}
	},

	async toggleFavorite(params = {}) {
		try {
			needLogin(this.openid)
			const bizType = validateString(params.bizType, 'bizType', 30)
			const refId = validateId(params.refId, 'refId')
			const existed = await db.collection('zy_favorites').where({
				openid: this.openid,
				biz_type: bizType,
				ref_id: refId,
				status: 1
			}).limit(1).get()
			if (existed.data && existed.data.length) {
				await db.collection('zy_favorites').doc(existed.data[0]._id).update({ status: 0, update_time: now() })
				return ok({ favorited: false })
			}
			await createUserRecord('zy_favorites', this.openid, {
				biz_type: bizType,
				ref_id: refId,
				title: validateString(params.title || '', 'title', 100, false),
				image: validateString(params.image || '', 'image', 300, false)
			})
			return ok({ favorited: true })
		} catch (error) {
			return handleError(error)
		}
	},

	async getBrowseHistory(params = {}) {
		try {
			needLogin(this.openid)
			return ok(await pageList('zy_browse_history', params, { openid: this.openid }))
		} catch (error) {
			return handleError(error)
		}
	},

	async getCoupons(params = {}) {
		try {
			needLogin(this.openid)
			const usable = params.usable === undefined ? '' : Boolean(params.usable)
			const where = { openid: dbCmd.in([this.openid, '']) }
			if (usable !== '') where.usable = usable
			return ok(await pageList('zy_coupons', params, where))
		} catch (error) {
			return handleError(error)
		}
	}
}
