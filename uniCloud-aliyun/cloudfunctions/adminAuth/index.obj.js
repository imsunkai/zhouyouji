const crypto = require('crypto')
const db = uniCloud.database()

const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_PASSWORD = '123456'

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

function trimString(value) {
	return typeof value === 'string' ? value.trim() : ''
}

function createToken(adminId) {
	const seed = `${adminId}:${now()}:${Math.random()}`
	return crypto.createHash('sha256').update(seed).digest('hex')
}

function formatAdmin(admin) {
	return {
		_id: admin._id,
		username: admin.username,
		nickname: admin.nickname,
		role: admin.role,
		status: admin.status,
		last_login_time: admin.last_login_time || 0
	}
}

function handleError(error) {
	const code = error && error.message ? error.message : 'INTERNAL_ERROR'
	const map = {
		USERNAME_REQUIRED: '请输入管理员账号',
		PASSWORD_REQUIRED: '请输入管理员密码',
		TOKEN_REQUIRED: '缺少登录 token',
		ADMIN_NOT_FOUND: '账号不存在',
		ADMIN_DISABLED: '账号已被禁用',
		PASSWORD_ERROR: '密码错误',
		LOGIN_EXPIRED: '登录已过期',
		INTERNAL_ERROR: '服务器异常'
	}
	return fail(map[code] ? code : 'INTERNAL_ERROR', map[code] || map.INTERNAL_ERROR)
}

async function createDefaultAdminIfTableEmpty(username, password) {
	if (username !== DEFAULT_ADMIN_USERNAME || password !== DEFAULT_ADMIN_PASSWORD) {
		return null
	}

	const countRes = await db.collection('admin_user').count()
	if (countRes.total > 0) {
		return null
	}

	const time = now()
	const payload = {
		username: DEFAULT_ADMIN_USERNAME,
		password: DEFAULT_ADMIN_PASSWORD,
		nickname: '管理员',
		role: 'admin',
		token: '',
		status: 1,
		last_login_time: 0,
		create_time: time,
		update_time: time
	}
	const addRes = await db.collection('admin_user').add(payload)
	return Object.assign({ _id: addRes.id }, payload)
}

module.exports = {
	async login(params = {}) {
		try {
			const username = trimString(params.username)
			const password = trimString(params.password)
			if (!username) throw new Error('USERNAME_REQUIRED')
			if (!password) throw new Error('PASSWORD_REQUIRED')

			const res = await db.collection('admin_user').where({ username }).limit(1).get()
			let admin = res.data && res.data[0]
			if (!admin) {
				admin = await createDefaultAdminIfTableEmpty(username, password)
			}
			if (!admin) throw new Error('ADMIN_NOT_FOUND')
			if (Number(admin.status) !== 1) throw new Error('ADMIN_DISABLED')
			if (admin.password !== password) throw new Error('PASSWORD_ERROR')

			const token = createToken(admin._id)
			const time = now()
			await db.collection('admin_user').doc(admin._id).update({
				token,
				last_login_time: time,
				update_time: time
			})

			admin.token = token
			admin.last_login_time = time
			return ok({
				token,
				admin: formatAdmin(admin)
			})
		} catch (error) {
			return handleError(error)
		}
	},

	async checkLogin(params = {}) {
		try {
			const token = trimString(params.token)
			if (!token) throw new Error('TOKEN_REQUIRED')

			const res = await db.collection('admin_user').where({
				token,
				status: 1
			}).limit(1).get()
			const admin = res.data && res.data[0]
			if (!admin) throw new Error('LOGIN_EXPIRED')

			return ok({
				admin: formatAdmin(admin)
			})
		} catch (error) {
			return handleError(error)
		}
	},

	async logout(params = {}) {
		try {
			const token = trimString(params.token)
			if (!token) throw new Error('TOKEN_REQUIRED')

			await db.collection('admin_user').where({ token }).update({
				token: '',
				update_time: now()
			})

			return ok()
		} catch (error) {
			return handleError(error)
		}
	}
}
