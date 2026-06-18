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

function openid(ctx) {
	const info = ctx.getClientInfo ? ctx.getClientInfo() : {}
	return info.OPENID || info.openid || ''
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
		ADMIN_TOKEN_REQUIRED: '缺少后台登录 token',
		ADMIN_LOGIN_EXPIRED: '后台登录已过期',
		LOGIN_REQUIRED: '请先登录',
		name_REQUIRED: '请填写姓名',
		phone_REQUIRED: '请填写手机号',
		type_REQUIRED: '缺少咨询类型',
		id_REQUIRED: '缺少ID',
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
	const res = await db.collection('admin_user').where({
		token: adminToken,
		status: 1
	}).limit(1).get()
	if (!res.data || !res.data.length) throw new Error('ADMIN_LOGIN_EXPIRED')
	return res.data[0]
}

async function pageList(params, where) {
	const p = page(params)
	const finalWhere = Object.assign({ status: 1 }, where)
	const totalRes = await db.collection('inquiry').where(finalWhere).count()
	const res = await db.collection('inquiry').where(finalWhere).orderBy('create_time', 'desc').skip((p.page - 1) * p.pageSize).limit(p.pageSize).get()
	return { list: res.data || [], total: totalRes.total || 0, page: p.page, pageSize: p.pageSize }
}

module.exports = {
	async submit(params = {}) {
		try {
			const userOpenid = openid(this)
			const time = now()
			const payload = {
				openid: userOpenid,
				service_id: str(params.serviceId, 'serviceId', 128, false),
				service_title: str(params.serviceTitle, 'serviceTitle', 100, false),
				car_id: str(params.carId, 'carId', 128, false),
				type: str(params.type, 'type', 30, true),
				name: str(params.name, 'name', 30, true),
				phone: str(params.phone, 'phone', 20, true),
				content: str(params.content, 'content', 500, false),
				inquiry_status: 'pending',
				remark: '',
				status: 1,
				create_time: time,
				update_time: time
			}
			const res = await db.collection('inquiry').add(payload)
			return ok({ id: res.id })
		} catch (error) {
			return handleError(error)
		}
	},

	async getMine(params = {}) {
		try {
			const userOpenid = openid(this)
			if (!userOpenid) throw new Error('LOGIN_REQUIRED')
			return ok(await pageList(params, { openid: userOpenid }))
		} catch (error) {
			return handleError(error)
		}
	},

	async updateStatus(params = {}) {
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
	}
}
