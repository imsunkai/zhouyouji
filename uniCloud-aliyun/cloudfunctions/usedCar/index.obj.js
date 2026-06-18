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

function num(value, field, required = false) {
	if ((value === undefined || value === null || value === '') && !required) return null
	const result = Number(value)
	if (!Number.isFinite(result)) throw new Error(`${field}_INVALID`)
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
		NOT_FOUND: '车源不存在',
		INTERNAL_ERROR: '服务器异常'
	}
	return fail(map[code] ? code : 'PARAM_INVALID', map[code] || '参数不合法')
}

async function pageList(params, where) {
	const p = page(params)
	const finalWhere = Object.assign({ status: 1 }, where)
	const totalRes = await db.collection('used_car').where(finalWhere).count()
	const res = await db.collection('used_car').where(finalWhere).orderBy('sort', 'asc').orderBy('create_time', 'desc').skip((p.page - 1) * p.pageSize).limit(p.pageSize).get()
	return { list: res.data || [], total: totalRes.total || 0, page: p.page, pageSize: p.pageSize }
}

module.exports = {
	async getList(params = {}) {
		try {
			const where = {}
			const brand = str(params.brand, 'brand', 50, false)
			const carStatus = str(params.carStatus, 'carStatus', 30, false)
			const minPrice = num(params.minPrice, 'minPrice', false)
			const maxPrice = num(params.maxPrice, 'maxPrice', false)
			if (brand) where.brand = brand
			if (carStatus) where.car_status = carStatus
			if (minPrice !== null && maxPrice !== null) where.price = cmd.gte(minPrice).and(cmd.lte(maxPrice))
			else if (minPrice !== null) where.price = cmd.gte(minPrice)
			else if (maxPrice !== null) where.price = cmd.lte(maxPrice)
			return ok(await pageList(params, where))
		} catch (error) {
			return handleError(error)
		}
	},

	async getDetail(params = {}) {
		try {
			const id = str(params.id, 'id', 128, true)
			const res = await db.collection('used_car').doc(id).get()
			const detail = res.data && res.data[0]
			if (!detail || detail.status !== 1) throw new Error('NOT_FOUND')
			return ok({ detail })
		} catch (error) {
			return handleError(error)
		}
	}
}
