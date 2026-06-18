const db = uniCloud.database()

function ok(data = {}) {
	return { errCode: 0, errMsg: 'success', data }
}

function fail(errCode, errMsg) {
	return { errCode, errMsg }
}

function now() {
	return Date.now()
}

function str(value, field, max, required = false) {
	const result = typeof value === 'string' ? value.trim() : ''
	if (required && !result) throw new Error(`${field}_REQUIRED`)
	if (result.length > max) throw new Error(`${field}_TOO_LONG`)
	return result
}

function num(value, field, required = false) {
	if ((value === undefined || value === null || value === '') && !required) return 0
	const result = Number(value)
	if (!Number.isFinite(result)) throw new Error(`${field}_INVALID`)
	return result
}

function bool(value) {
	return value === true || value === 'true' || value === 1
}

function page(params = {}) {
	const current = Number(params.page || 1)
	const pageSize = Number(params.pageSize || 10)
	if (!Number.isInteger(current) || current < 1) throw new Error('PAGE_INVALID')
	if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('PAGESIZE_INVALID')
	return { page: current, pageSize }
}

function handleError(error) {
	const code = error && error.message ? error.message : 'INTERNAL_ERROR'
	const map = {
		ADMIN_TOKEN_REQUIRED: '缺少后台登录 token',
		ADMIN_LOGIN_EXPIRED: '后台登录已过期',
		id_REQUIRED: '缺少ID',
		title_REQUIRED: '请填写标题',
		type_REQUIRED: '请选择业务类型',
		brand_REQUIRED: '请填写品牌',
		image_REQUIRED: '请填写图片地址',
		position_REQUIRED: '请选择轮播图位置',
		inquiryStatus_REQUIRED: '缺少咨询状态',
		PAGE_INVALID: '分页页码不合法',
		PAGESIZE_INVALID: '分页大小不合法',
		INTERNAL_ERROR: '服务器异常'
	}
	return fail(map[code] ? code : 'PARAM_INVALID', map[code] || '参数不合法')
}

async function requireAdmin(token) {
	const adminToken = str(token, 'adminToken', 128, false)
	if (!adminToken) throw new Error('ADMIN_TOKEN_REQUIRED')
	const res = await db.collection('admin_user').where({ token: adminToken, status: 1 }).limit(1).get()
	if (!res.data || !res.data.length) throw new Error('ADMIN_LOGIN_EXPIRED')
	return res.data[0]
}

async function pageList(collection, params, where = {}, includeOffShelf = true) {
	const p = page(params)
	const finalWhere = Object.assign({}, where)
	if (!includeOffShelf) finalWhere.status = 1
	const totalRes = await db.collection(collection).where(finalWhere).count()
	const res = await db.collection(collection)
		.where(finalWhere)
		.orderBy('create_time', 'desc')
		.skip((p.page - 1) * p.pageSize)
		.limit(p.pageSize)
		.get()
	return { list: res.data || [], total: totalRes.total || 0, page: p.page, pageSize: p.pageSize }
}

function servicePayload(params, isCreate) {
	const time = now()
	const data = {
		category_id: str(params.categoryId, 'categoryId', 128, false),
		category_name: str(params.categoryName, 'categoryName', 50, false),
		type: str(params.type, 'type', 30, isCreate),
		title: str(params.title, 'title', 100, isCreate),
		subtitle: str(params.subtitle, 'subtitle', 100, false),
		description: str(params.description, 'description', 500, false),
		content: str(params.content, 'content', 5000, false),
		cover: str(params.cover, 'cover', 300, false),
		images: Array.isArray(params.images) ? params.images : [],
		price: num(params.price, 'price', false),
		unit: str(params.unit, 'unit', 20, false),
		contact_name: str(params.contactName, 'contactName', 30, false),
		contact_phone: str(params.contactPhone, 'contactPhone', 20, false),
		address: str(params.address, 'address', 200, false),
		tags: Array.isArray(params.tags) ? params.tags : [],
		is_recommend: bool(params.isRecommend),
		sort: Number.isInteger(Number(params.sort)) ? Number(params.sort) : 0,
		update_time: time
	}
	if (isCreate) {
		data.status = Number(params.status) === 0 ? 0 : 1
		data.create_time = time
	}
	return data
}

function usedCarPayload(params, isCreate) {
	const time = now()
	const data = {
		brand: str(params.brand, 'brand', 50, isCreate),
		series: str(params.series, 'series', 50, false),
		title: str(params.title, 'title', 120, isCreate),
		cover: str(params.cover, 'cover', 300, false),
		images: Array.isArray(params.images) ? params.images : [],
		price: num(params.price, 'price', false),
		year: str(params.year, 'year', 20, false),
		mileage: str(params.mileage, 'mileage', 30, false),
		gearbox: str(params.gearbox, 'gearbox', 30, false),
		fuel_type: str(params.fuelType, 'fuelType', 30, false),
		car_status: str(params.carStatus || 'selling', 'carStatus', 30, false),
		description: str(params.description, 'description', 1000, false),
		contact_name: str(params.contactName, 'contactName', 30, false),
		contact_phone: str(params.contactPhone, 'contactPhone', 20, false),
		sort: Number.isInteger(Number(params.sort)) ? Number(params.sort) : 0,
		update_time: time
	}
	if (isCreate) {
		data.status = Number(params.status) === 0 ? 0 : 1
		data.create_time = time
	}
	return data
}

function bannerPayload(params, isCreate) {
	const time = now()
	const data = {
		title: str(params.title, 'title', 100, isCreate),
		image: str(params.image, 'image', 300, isCreate),
		link_type: str(params.linkType || 'none', 'linkType', 30, false),
		link_id: str(params.linkId, 'linkId', 128, false),
		link_url: str(params.linkUrl, 'linkUrl', 300, false),
		position: str(params.position || 'home', 'position', 50, isCreate),
		sort: Number.isInteger(Number(params.sort)) ? Number(params.sort) : 0,
		update_time: time
	}
	if (isCreate) {
		data.status = Number(params.status) === 0 ? 0 : 1
		data.create_time = time
	}
	return data
}

module.exports = {
	async getDashboard(params = {}) {
		try {
			await requireAdmin(params.token)
			const [serviceCount, inquiryCount, carCount, bannerCount] = await Promise.all([
				db.collection('service').where({ status: 1 }).count(),
				db.collection('inquiry').where({ status: 1 }).count(),
				db.collection('used_car').where({ status: 1 }).count(),
				db.collection('banner').where({ status: 1 }).count()
			])
			return ok({
				serviceCount: serviceCount.total || 0,
				inquiryCount: inquiryCount.total || 0,
				carCount: carCount.total || 0,
				bannerCount: bannerCount.total || 0
			})
		} catch (error) {
			return handleError(error)
		}
	},

	async getServiceList(params = {}) {
		try {
			await requireAdmin(params.token)
			return ok(await pageList('service', params))
		} catch (error) {
			return handleError(error)
		}
	},

	async addService(params = {}) {
		try {
			await requireAdmin(params.token)
			const res = await db.collection('service').add(servicePayload(params, true))
			return ok({ id: res.id })
		} catch (error) {
			return handleError(error)
		}
	},

	async editService(params = {}) {
		try {
			await requireAdmin(params.token)
			const id = str(params.id, 'id', 128, true)
			await db.collection('service').doc(id).update(servicePayload(params, false))
			return ok()
		} catch (error) {
			return handleError(error)
		}
	},

	async setServiceStatus(params = {}) {
		try {
			await requireAdmin(params.token)
			const id = str(params.id, 'id', 128, true)
			const status = Number(params.status) === 1 ? 1 : 0
			await db.collection('service').doc(id).update({ status, update_time: now() })
			return ok()
		} catch (error) {
			return handleError(error)
		}
	},

	async getInquiryList(params = {}) {
		try {
			await requireAdmin(params.token)
			const where = {}
			const inquiryStatus = str(params.inquiryStatus, 'inquiryStatus', 30, false)
			if (inquiryStatus) where.inquiry_status = inquiryStatus
			return ok(await pageList('inquiry', params, where))
		} catch (error) {
			return handleError(error)
		}
	},

	async updateInquiryStatus(params = {}) {
		try {
			await requireAdmin(params.token)
			const id = str(params.id, 'id', 128, true)
			const inquiryStatus = str(params.inquiryStatus, 'inquiryStatus', 30, true)
			await db.collection('inquiry').doc(id).update({
				inquiry_status: inquiryStatus,
				remark: str(params.remark, 'remark', 300, false),
				update_time: now()
			})
			return ok()
		} catch (error) {
			return handleError(error)
		}
	},

	async getUsedCarList(params = {}) {
		try {
			await requireAdmin(params.token)
			return ok(await pageList('used_car', params))
		} catch (error) {
			return handleError(error)
		}
	},

	async addUsedCar(params = {}) {
		try {
			await requireAdmin(params.token)
			const res = await db.collection('used_car').add(usedCarPayload(params, true))
			return ok({ id: res.id })
		} catch (error) {
			return handleError(error)
		}
	},

	async setUsedCarStatus(params = {}) {
		try {
			await requireAdmin(params.token)
			const id = str(params.id, 'id', 128, true)
			const status = Number(params.status) === 1 ? 1 : 0
			await db.collection('used_car').doc(id).update({ status, update_time: now() })
			return ok()
		} catch (error) {
			return handleError(error)
		}
	},

	async getBannerList(params = {}) {
		try {
			await requireAdmin(params.token)
			return ok(await pageList('banner', params))
		} catch (error) {
			return handleError(error)
		}
	},

	async addBanner(params = {}) {
		try {
			await requireAdmin(params.token)
			const res = await db.collection('banner').add(bannerPayload(params, true))
			return ok({ id: res.id })
		} catch (error) {
			return handleError(error)
		}
	},

	async setBannerStatus(params = {}) {
		try {
			await requireAdmin(params.token)
			const id = str(params.id, 'id', 128, true)
			const status = Number(params.status) === 1 ? 1 : 0
			await db.collection('banner').doc(id).update({ status, update_time: now() })
			return ok()
		} catch (error) {
			return handleError(error)
		}
	}
}
