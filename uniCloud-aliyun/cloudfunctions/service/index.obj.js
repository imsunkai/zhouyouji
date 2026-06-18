const db = uniCloud.database()
const cmd = db.command

function ok(data = {}) {
	return { errCode: 0, errMsg: 'success', data }
}

function fail(errCode, errMsg) {
	return { errCode, errMsg }
}

function str(value, field, max, required = false) {
	const result = typeof value === 'string' ? value.trim() : ''
	if (required && !result) throw new Error(`${field}_REQUIRED`)
	if (result.length > max) throw new Error(`${field}_TOO_LONG`)
	return result
}

function page(params = {}) {
	const page = Number(params.page || 1)
	const pageSize = Number(params.pageSize || 10)
	if (!Number.isInteger(page) || page < 1) throw new Error('PAGE_INVALID')
	if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error('PAGESIZE_INVALID')
	return { page, pageSize }
}

function handleError(error) {
	const code = error && error.message ? error.message : 'INTERNAL_ERROR'
	const map = {
		id_REQUIRED: '缺少ID',
		PAGE_INVALID: '分页页码不合法',
		PAGESIZE_INVALID: '分页大小不合法',
		NOT_FOUND: '服务不存在',
		INTERNAL_ERROR: '服务器异常'
	}
	return fail(map[code] ? code : 'PARAM_INVALID', map[code] || '参数不合法')
}

async function list(params = {}, extraWhere = {}) {
	const p = page(params)
	const where = Object.assign({ status: 1 }, extraWhere)
	const totalRes = await db.collection('service').where(where).count()
	const res = await db.collection('service')
		.where(where)
		.orderBy('sort', 'asc')
		.orderBy('create_time', 'desc')
		.skip((p.page - 1) * p.pageSize)
		.limit(p.pageSize)
		.get()
	return { list: res.data || [], total: totalRes.total || 0, page: p.page, pageSize: p.pageSize }
}

module.exports = {
	async getHomeRecommend(params = {}) {
		try {
			return ok(await list(Object.assign({ pageSize: 10 }, params), { is_recommend: true }))
		} catch (error) {
			return handleError(error)
		}
	},

	async getCategoryList(params = {}) {
		try {
			const type = str(params.type, 'type', 30, false)
			const where = { status: 1 }
			if (type) where.type = type
			const res = await db.collection('category').where(where).orderBy('sort', 'asc').get()
			return ok({ list: res.data || [] })
		} catch (error) {
			return handleError(error)
		}
	},

	async getListByCategory(params = {}) {
		try {
			const where = {}
			const categoryId = str(params.categoryId, 'categoryId', 128, false)
			const type = str(params.type, 'type', 30, false)
			if (categoryId) where.category_id = categoryId
			if (type) where.type = type
			return ok(await list(params, where))
		} catch (error) {
			return handleError(error)
		}
	},

	async getDetail(params = {}) {
		try {
			const id = str(params.id, 'id', 128, true)
			const res = await db.collection('service').doc(id).get()
			const detail = res.data && res.data[0]
			if (!detail || detail.status !== 1) throw new Error('NOT_FOUND')
			return ok({ detail })
		} catch (error) {
			return handleError(error)
		}
	},

	async search(params = {}) {
		try {
			const keyword = str(params.keyword, 'keyword', 50, true)
			return ok(await list(params, {
				title: new RegExp(keyword, 'i')
			}))
		} catch (error) {
			return handleError(error)
		}
	}
}
