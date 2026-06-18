const cloud = require('wx-server-sdk')

cloud.init({
	env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

function ok(data = {}) {
	return { errCode: 0, errMsg: 'success', data }
}

function fail(errCode, errMsg) {
	return { errCode, errMsg, data: {} }
}

function now() {
	return Date.now()
}

function trim(value) {
	return typeof value === 'string' ? value.trim() : ''
}

function num(value) {
	const result = Number(value || 0)
	return Number.isFinite(result) ? result : 0
}

function str(value, field, max, required = false) {
	const result = trim(value)
	if (required && !result) throw new Error(field + '_REQUIRED')
	if (result.length > max) throw new Error(field + '_TOO_LONG')
	return result
}

function pageParams(params = {}) {
	const page = Math.max(1, Number(params.page || 1))
	const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 10)))
	return { page, pageSize }
}

function getOpenid() {
	const ctx = cloud.getWXContext()
	return ctx.OPENID || ''
}

function handleError(error) {
	const code = error && error.message ? error.message : 'INTERNAL_ERROR'
	const map = {
		LOGIN_REQUIRED: '请先登录',
		CONTENT_REQUIRED: '请填写反馈内容',
		NAME_REQUIRED: '请填写收货人',
		PHONE_REQUIRED: '请填写手机号',
		ADDRESS_REQUIRED: '请填写详细地址',
		id_REQUIRED: '缺少ID',
		NOT_FOUND: '数据不存在',
		PAGE_INVALID: '分页参数不合法',
		INTERNAL_ERROR: '服务器异常'
	}
	if (code.indexOf('_TOO_LONG') > -1) return fail(code, '内容过长')
	return fail(map[code] ? code : 'INTERNAL_ERROR', map[code] || map.INTERNAL_ERROR)
}

async function safeList(collection, where = {}, limit = 20) {
	try {
		const res = await db.collection(collection)
			.where(Object.assign({ status: 1 }, where))
			.orderBy('create_time', 'desc')
			.limit(limit)
			.get()
		return res.data || []
	} catch (error) {
		return []
	}
}

async function safeCount(collection, where = {}) {
	try {
		const res = await db.collection(collection).where(Object.assign({ status: 1 }, where)).count()
		return res.total || 0
	} catch (error) {
		return 0
	}
}

async function pageList(collection, params = {}, where = {}) {
	const p = pageParams(params)
	const finalWhere = Object.assign({ status: 1 }, where)
	const [countRes, listRes] = await Promise.all([
		db.collection(collection).where(finalWhere).count(),
		db.collection(collection)
			.where(finalWhere)
			.orderBy('create_time', 'desc')
			.skip((p.page - 1) * p.pageSize)
			.limit(p.pageSize)
			.get()
	])
	return {
		list: listRes.data || [],
		total: countRes.total || 0,
		page: p.page,
		pageSize: p.pageSize
	}
}

async function getDetail(collection, id) {
	const value = str(id, 'id', 128, true)
	const res = await db.collection(collection).doc(value).get()
	const detail = res.data
	if (!detail || detail.status === 0) throw new Error('NOT_FOUND')
	return detail
}

async function getOrCreateUser(params = {}) {
	const openid = getOpenid()
	if (!openid) throw new Error('LOGIN_REQUIRED')
	const time = now()
	const nickname = str(params.nickname || '', 'nickname', 40, false)
	const avatar = str(params.avatar || '', 'avatar', 300, false)
	const phone = str(params.phone || '', 'phone', 20, false)
	const gender = str(params.gender || '', 'gender', 20, false)
	const res = await db.collection('user').where({ openid }).limit(1).get()
	if (res.data && res.data.length) {
		const user = res.data[0]
		const updateData = { update_time: time }
		if (nickname && (params.forceProfileUpdate || nickname != '舟游记用户')) updateData.nickname = nickname
		if (avatar) updateData.avatar = avatar
		if (phone) updateData.phone = phone
		if (gender) updateData.gender = gender
		await db.collection('user').doc(user._id).update({ data: updateData })
		return Object.assign({}, user, updateData)
	}
	const payload = {
		openid,
		nickname: nickname || '舟游记用户',
		avatar,
		phone,
		gender,
		status: 1,
		create_time: time,
		update_time: time
	}
	const addRes = await db.collection('user').add({ data: payload })
	return Object.assign({ _id: addRes._id }, payload)
}

function orderStatusWhere(status) {
	const value = trim(status)
	const map = {
		pending_pay: ['pending_pay', '待付款'],
		pending_send: ['paid', 'pending_send', '待发货'],
		pending_receive: ['shipped', 'pending_receive', '待收货'],
		pending_comment: ['received', 'pending_comment', '待评价'],
		after_sale: ['refund', 'after_sale', '售后', '退款']
	}
	return map[value] || (value ? [value] : [])
}

function isOrderStatus(status, keys) {
	const value = trim(status)
	return keys.indexOf(value) > -1
}

function formatOrder(item) {
	const first = item.items && item.items.length ? item.items[0] : {}
	const product = first.product_snapshot || first.product || {}
	return {
		_id: item._id || '',
		no: item.order_no || '',
		status: item.order_status || '',
		title: product.name || product.title || item.title || '舟游记订单',
		desc: product.desc || product.subtitle || item.order_type || '舟山本地服务',
		image: product.image || item.image || '/static/logo.png',
	price: num(item.pay_amount || item.amount)
	}
}

function formatOrderDetail(item) {
	const first = item.items && item.items.length ? item.items[0] : {}
	const product = first.product_snapshot || first.product || {}
	return {
		_id: item._id || '',
		no: item.order_no || item.no || '',
		status: item.order_status || '',
		title: product.name || product.title || item.title || '舟游记订单',
		desc: product.desc || product.subtitle || item.order_type || '舟山本地服务',
		image: product.image || item.image || '/static/logo.png',
		price: num(item.pay_amount || item.amount),
		createTime: item.create_time ? new Date(item.create_time).toLocaleString() : '',
		payType: item.pay_type || item.payment || '微信支付',
		receiver: item.receiver || item.address_name || '',
		phone: item.phone || item.address_phone || '',
		address: item.address || item.address_detail || ''
	}
}

function formatFavorite(item) {
	return {
		_id: item._id || '',
		title: item.title || '舟游记收藏',
		desc: item.desc || '已收藏的舟山本地资源',
		tag: item.biz_type || '服务',
		image: item.image || '/static/logo.png'
	}
}

function formatAddress(item) {
	const region = [item.province || '', item.city || '', item.district || ''].join('')
	return {
		_id: item._id || '',
		name: item.name || '',
		phone: item.phone || '',
		address: region + (item.address || ''),
		is_default: Boolean(item.is_default)
	}
}

function formatCoupon(item) {
	const threshold = num(item.threshold)
	return {
		_id: item._id || '',
		title: item.title || '舟游记优惠券',
		amount: num(item.amount),
		condition: threshold > 0 ? '满' + threshold + '可用' : '无门槛',
		desc: item.desc || '舟游记专属福利',
		time: item.end_time ? '有效期至 ' + new Date(item.end_time).toLocaleDateString() : '长期有效'
	}
}

function formatHistory(item) {
	return {
		_id: item._id || '',
		title: item.title || '舟游记足迹',
		desc: item.biz_type || '浏览记录',
		time: item.create_time ? new Date(item.create_time).toLocaleString() : '',
		image: item.image || '/static/logo.png'
	}
}

function serviceItem(item) {
	return {
		_id: item._id || '',
		cover: item.cover || item.image || '',
		image: item.image || item.cover || '',
		title: item.title || item.name || '',
		description: item.description || item.desc || '',
		subtitle: item.subtitle || item.desc || '',
		price: item.price || '',
		unit: item.unit || '',
		category_name: item.category_name || item.tag || ''
	}
}

function carItem(item) {
	return {
		_id: item._id || '',
		cover: item.cover || item.image || '',
		title: item.title || '',
		year: item.year || '',
		mileage: item.mileage || '',
		gearbox: item.gearbox || '',
		price: item.price || '',
		brand: item.brand || item.location || '',
		car_status: item.car_status || item.tag || '',
		description: item.description || item.desc || ''
	}
}

const userApi = {
	async wxLogin(params = {}) {
		return ok({ user: await getOrCreateUser(params) })
	},

	async getUserInfo(params = {}) {
		return ok({ user: await getOrCreateUser(params) })
	},

	async updateProfile(params = {}) {
		return ok({ user: await getOrCreateUser(Object.assign({}, params, { forceProfileUpdate: true })) })
	},

	async getMyCenter(params = {}) {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const user = await getOrCreateUser(params)
		const orders = await safeList('zy_orders', { openid }, 100)
		const orderCounts = {
			pendingPay: 0,
			pendingSend: 0,
			pendingReceive: 0,
			pendingComment: 0,
			afterSale: 0
		}
		orders.forEach(item => {
			const status = item.order_status || ''
			if (isOrderStatus(status, ['pending_pay', '待付款'])) orderCounts.pendingPay += 1
			if (isOrderStatus(status, ['paid', 'pending_send', '待发货'])) orderCounts.pendingSend += 1
			if (isOrderStatus(status, ['shipped', 'pending_receive', '待收货'])) orderCounts.pendingReceive += 1
			if (isOrderStatus(status, ['received', 'pending_comment', '待评价'])) orderCounts.pendingComment += 1
			if (isOrderStatus(status, ['refund', 'after_sale', '售后', '退款'])) orderCounts.afterSale += 1
		})
		const [favorites, addresses, coupons, history] = await Promise.all([
			safeCount('zy_favorites', { openid }),
			safeCount('zy_addresses', { openid }),
			safeCount('zy_coupons', { openid: _.in([openid, '']) }),
			safeCount('zy_browse_history', { openid })
		])
		return ok({
			user,
			orderCounts,
			serviceCounts: { favorites, addresses, coupons, history }
		})
	},

	async getOrders(params = {}) {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const where = { openid }
		const statusList = orderStatusWhere(params.status || '')
		if (statusList.length) where.order_status = _.in(statusList)
		const list = await safeList('zy_orders', where, 50)
		return ok({ list: list.map(formatOrder) })
	},

	async getOrderDetail(params = {}) {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const id = str(params.id || '', 'id', 128, true)
		const res = await db.collection('zy_orders').where({ _id: id, openid, status: 1 }).limit(1).get()
		const detail = res.data && res.data.length ? res.data[0] : null
		if (!detail) throw new Error('NOT_FOUND')
		return ok({ detail: formatOrderDetail(detail) })
	},

	async getFavorites() {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const list = await safeList('zy_favorites', { openid }, 50)
		return ok({ list: list.map(formatFavorite) })
	},

	async getAddresses() {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const list = await safeList('zy_addresses', { openid }, 50)
		return ok({ list: list.map(formatAddress) })
	},

	async saveAddress(params = {}) {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const time = now()
		const payload = {
			openid,
			name: str(params.name || '', 'NAME', 30, true),
			phone: str(params.phone || '', 'PHONE', 20, true),
			province: str(params.province || '', 'province', 30, false),
			city: str(params.city || '', 'city', 30, false),
			district: str(params.district || '', 'district', 30, false),
			address: str(params.address || '', 'ADDRESS', 200, true),
			is_default: Boolean(params.isDefault),
			status: 1,
			create_time: time,
			update_time: time
		}
		if (payload.is_default) {
			await db.collection('zy_addresses').where({ openid, status: 1 }).update({
				data: { is_default: false, update_time: time }
			})
		}
		const addRes = await db.collection('zy_addresses').add({ data: payload })
		return ok({ id: addRes._id })
	},

	async getCoupons() {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const list = await safeList('zy_coupons', { openid: _.in([openid, '']) }, 50)
		return ok({ list: list.map(formatCoupon) })
	},

	async getBrowseHistory() {
		const openid = getOpenid()
		if (!openid) throw new Error('LOGIN_REQUIRED')
		const list = await safeList('zy_browse_history', { openid }, 50)
		return ok({ list: list.map(formatHistory) })
	},

	async submitFeedback(params = {}) {
		const openid = getOpenid()
		const payload = {
			openid,
			feedback_type: str(params.type || '功能建议', 'type', 30, false) || '功能建议',
			content: str(params.content || '', 'CONTENT', 1000, true),
			contact: str(params.contact || '', 'contact', 100, false),
			status: 1,
			create_time: now(),
			update_time: now()
		}
		const addRes = await db.collection('zy_feedback').add({ data: payload })
		return ok({ id: addRes._id })
	}
}

const serviceApi = {
	async getHomeRecommend(params = {}) {
		const data = await pageList('service', Object.assign({ pageSize: 10 }, params), { is_recommend: true })
		data.list = data.list.map(serviceItem)
		return ok(data)
	},

	async getCategoryList(params = {}) {
		const where = { status: 1 }
		const type = trim(params.type || '')
		if (type) where.type = type
		const res = await db.collection('category').where(where).orderBy('sort', 'asc').get()
		return ok({ list: res.data || [] })
	},

	async getListByCategory(params = {}) {
		const where = {}
		if (params.categoryId) where.category_id = trim(params.categoryId)
		if (params.type) where.type = trim(params.type)
		const data = await pageList('service', params, where)
		data.list = data.list.map(serviceItem)
		return ok(data)
	},

	async getDetail(params = {}) {
		return ok({ detail: await getDetail('service', params.id) })
	}
}

const usedCarApi = {
	async getList(params = {}) {
		const where = {}
		if (params.keyword) where.title = db.RegExp({ regexp: trim(params.keyword), options: 'i' })
		const data = await pageList('used_car', params, where)
		data.list = data.list.map(carItem)
		return ok(data)
	},

	async getDetail(params = {}) {
		return ok({ detail: await getDetail('used_car', params.id) })
	}
}

const apis = {
	user: userApi,
	service: serviceApi,
	usedCar: usedCarApi
}

exports.main = async (event = {}) => {
	try {
		const object = trim(event.object)
		const method = trim(event.method)
		const params = event.params || {}
		if (!apis[object] || typeof apis[object][method] !== 'function') {
			return fail('METHOD_NOT_FOUND', '接口不存在')
		}
		return await apis[object][method](params)
	} catch (error) {
		return handleError(error)
	}
}
