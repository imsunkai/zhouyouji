const db = uniCloud.database()
const dbCmd = db.command

function ok(data = {}) {
	return { errCode: 0, errMsg: 'success', data }
}

function fail(errCode, errMsg) {
	return { errCode, errMsg }
}

function now() {
	return Date.now()
}

function trim(value) {
	return typeof value === 'string' ? value.trim() : ''
}

function number(value) {
	const num = Number(value || 0)
	return Number.isFinite(num) ? num : 0
}

function getClientOpenid(ctx, params = {}) {
	const info = ctx.getClientInfo ? ctx.getClientInfo() : {}
	const openid = info.OPENID || info.openid || ''
	if (openid) return openid

	const anonymousId = trim(params.anonymousId)
	if (anonymousId) return 'h5_' + anonymousId

	return 'h5_' + now() + '_' + Math.floor(Math.random() * 1000000)
}

function str(value, field, max, required = false) {
	const result = trim(value)
	if (required && !result) throw new Error(field + '_REQUIRED')
	if (result.length > max) throw new Error(field + '_TOO_LONG')
	return result
}

function handleError(error) {
	const code = error && error.message ? error.message : 'INTERNAL_ERROR'
	const map = {
		LOGIN_REQUIRED: '\u767b\u5f55\u72b6\u6001\u65e0\u6548',
		CONTENT_REQUIRED: '\u8bf7\u586b\u5199\u53cd\u9988\u5185\u5bb9',
		NAME_REQUIRED: '\u8bf7\u586b\u5199\u6536\u8d27\u4eba',
		PHONE_REQUIRED: '\u8bf7\u586b\u5199\u624b\u673a\u53f7',
		ADDRESS_REQUIRED: '\u8bf7\u586b\u5199\u8be6\u7ec6\u5730\u5740',
		nickname_TOO_LONG: '\u6635\u79f0\u8fc7\u957f',
		avatar_TOO_LONG: '\u5934\u50cf\u5730\u5740\u8fc7\u957f',
		phone_TOO_LONG: '\u624b\u673a\u53f7\u8fc7\u957f',
		gender_TOO_LONG: '\u6027\u522b\u53c2\u6570\u8fc7\u957f',
		INTERNAL_ERROR: '\u670d\u52a1\u5668\u9519\u8bef'
	}
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

function isOrderStatus(status, keys) {
	const value = trim(status)
	for (let i = 0; i < keys.length; i++) {
		if (value === keys[i]) return true
	}
	return false
}

function orderStatusWhere(status) {
	const value = trim(status)
	const map = {
		pending_pay: ['pending_pay', '\u5f85\u4ed8\u6b3e'],
		pending_send: ['paid', 'pending_send', '\u5f85\u53d1\u8d27'],
		pending_receive: ['shipped', 'pending_receive', '\u5f85\u6536\u8d27'],
		pending_comment: ['received', 'pending_comment', '\u5f85\u8bc4\u4ef7'],
		after_sale: ['refund', 'after_sale', '\u552e\u540e', '\u9000\u6b3e']
	}
	return map[value] || (value ? [value] : [])
}

function formatOrder(item) {
	const first = item.items && item.items.length ? item.items[0] : {}
	const product = first.product_snapshot || first.product || {}
	return {
		_id: item._id || '',
		no: item.order_no || '',
		status: item.order_status || '',
		title: product.name || product.title || item.title || '\u821f\u6e38\u8bb0\u8ba2\u5355',
		desc: product.desc || product.subtitle || item.order_type || '\u821f\u5c71\u672c\u5730\u670d\u52a1',
		image: product.image || item.image || '/static/logo.png',
		price: number(item.pay_amount || item.amount)
	}
}

function formatCoupon(item) {
	const threshold = number(item.threshold)
	return {
		_id: item._id || '',
		title: item.title || '\u821f\u6e38\u8bb0\u4f18\u60e0\u5238',
		amount: number(item.amount),
		condition: threshold > 0 ? '\u6ee1' + threshold + '\u53ef\u7528' : '\u65e0\u95e8\u69db',
		desc: item.desc || '\u821f\u6e38\u8bb0\u4e13\u5c5e\u798f\u5229',
		time: item.end_time ? '\u6709\u6548\u671f\u81f3 ' + new Date(item.end_time).toLocaleDateString() : '\u957f\u671f\u6709\u6548'
	}
}

function formatFavorite(item) {
	return {
		_id: item._id || '',
		title: item.title || '\u821f\u6e38\u8bb0\u6536\u85cf',
		desc: item.desc || '\u5df2\u6536\u85cf\u7684\u821f\u5c71\u672c\u5730\u8d44\u6e90',
		tag: item.biz_type || '\u670d\u52a1',
		image: item.image || '/static/logo.png'
	}
}

function formatHistory(item) {
	return {
		_id: item._id || '',
		title: item.title || '\u821f\u6e38\u8bb0\u8db3\u8ff9',
		desc: item.biz_type || '\u6d4f\u89c8\u8bb0\u5f55',
		time: item.create_time ? new Date(item.create_time).toLocaleString() : '',
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

async function getOrCreateUser(openid, params = {}) {
	const time = now()
	const nickname = str(params.nickname || '', 'nickname', 40, false)
	const avatar = str(params.avatar || '', 'avatar', 300, false)
	const phone = str(params.phone || '', 'phone', 20, false)
	const gender = str(params.gender || '', 'gender', 20, false)

	const res = await db.collection('user').where({ openid }).limit(1).get()
	if (res.data && res.data.length) {
		const user = res.data[0]
		const updateData = { update_time: time }
		if (nickname) updateData.nickname = nickname
		if (avatar) updateData.avatar = avatar
		if (phone) updateData.phone = phone
		if (gender) updateData.gender = gender
		await db.collection('user').doc(user._id).update(updateData)
		return Object.assign({}, user, updateData)
	}

	const payload = {
		openid,
		nickname: nickname || '\u821f\u6e38\u8bb0\u7528\u6237',
		avatar,
		phone,
		gender,
		status: 1,
		create_time: time,
		update_time: time
	}
	const addRes = await db.collection('user').add(payload)
	return Object.assign({ _id: addRes.id }, payload)
}

module.exports = {
	async wxLogin(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			if (!openid) throw new Error('LOGIN_REQUIRED')
			const user = await getOrCreateUser(openid, params)
			return ok({ user })
		} catch (error) {
			return handleError(error)
		}
	},

	async getUserInfo(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			if (!openid) throw new Error('LOGIN_REQUIRED')
			const user = await getOrCreateUser(openid, {})
			return ok({ user })
		} catch (error) {
			return handleError(error)
		}
	},

	async updateProfile(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			if (!openid) throw new Error('LOGIN_REQUIRED')
			const user = await getOrCreateUser(openid, params)
			return ok({ user })
		} catch (error) {
			return handleError(error)
		}
	},

	async getMyCenter(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			if (!openid) throw new Error('LOGIN_REQUIRED')
			const user = await getOrCreateUser(openid, {})
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
				if (isOrderStatus(status, ['pending_pay', '\u5f85\u4ed8\u6b3e'])) orderCounts.pendingPay += 1
				if (isOrderStatus(status, ['paid', 'pending_send', '\u5f85\u53d1\u8d27'])) orderCounts.pendingSend += 1
				if (isOrderStatus(status, ['shipped', 'pending_receive', '\u5f85\u6536\u8d27'])) orderCounts.pendingReceive += 1
				if (isOrderStatus(status, ['received', 'pending_comment', '\u5f85\u8bc4\u4ef7'])) orderCounts.pendingComment += 1
				if (isOrderStatus(status, ['refund', 'after_sale', '\u552e\u540e', '\u9000\u6b3e'])) orderCounts.afterSale += 1
			})
			const [favoritesCount, addressCount, couponCount, historyCount] = await Promise.all([
				safeCount('zy_favorites', { openid }),
				safeCount('zy_addresses', { openid }),
				safeCount('zy_coupons', { openid: dbCmd.in([openid, '']) }),
				safeCount('zy_browse_history', { openid })
			])
			return ok({
				user,
				orderCounts,
				serviceCounts: {
					favorites: favoritesCount,
					addresses: addressCount,
					coupons: couponCount,
					history: historyCount
				}
			})
		} catch (error) {
			return handleError(error)
		}
	},

	async getOrders(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			const status = trim(params.status || '')
			const where = { openid }
			const statusList = orderStatusWhere(status)
			if (statusList.length) where.order_status = dbCmd.in(statusList)
			const list = await safeList('zy_orders', where, 50)
			return ok({ list: list.map(formatOrder) })
		} catch (error) {
			return handleError(error)
		}
	},

	async getFavorites(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			const list = await safeList('zy_favorites', { openid }, 50)
			return ok({ list: list.map(formatFavorite) })
		} catch (error) {
			return handleError(error)
		}
	},

	async getAddresses(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			const list = await safeList('zy_addresses', { openid }, 50)
			return ok({ list: list.map(formatAddress) })
		} catch (error) {
			return handleError(error)
		}
	},

	async saveAddress(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			const name = str(params.name || '', 'NAME', 30, true)
			const phone = str(params.phone || '', 'PHONE', 20, true)
			const address = str(params.address || '', 'ADDRESS', 200, true)
			const time = now()
			const payload = {
				openid,
				name,
				phone,
				province: str(params.province || '', 'province', 30, false),
				city: str(params.city || '', 'city', 30, false),
				district: str(params.district || '', 'district', 30, false),
				address,
				is_default: Boolean(params.isDefault),
				status: 1,
				create_time: time,
				update_time: time
			}
			if (payload.is_default) {
				await db.collection('zy_addresses').where({ openid, status: 1 }).update({ is_default: false, update_time: time })
			}
			const addRes = await db.collection('zy_addresses').add(payload)
			return ok({ id: addRes.id })
		} catch (error) {
			return handleError(error)
		}
	},

	async getCoupons(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			const list = await safeList('zy_coupons', { openid: dbCmd.in([openid, '']) }, 50)
			return ok({ list: list.map(formatCoupon) })
		} catch (error) {
			return handleError(error)
		}
	},

	async getBrowseHistory(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			const list = await safeList('zy_browse_history', { openid }, 50)
			return ok({ list: list.map(formatHistory) })
		} catch (error) {
			return handleError(error)
		}
	},

	async submitFeedback(params = {}) {
		try {
			const openid = getClientOpenid(this, params)
			const content = str(params.content || '', 'CONTENT', 1000, true)
			const payload = {
				openid,
				feedback_type: str(params.type || '\u529f\u80fd\u5efa\u8bae', 'type', 30, false) || '\u529f\u80fd\u5efa\u8bae',
				content,
				contact: str(params.contact || '', 'contact', 100, false),
				status: 1,
				create_time: now(),
				update_time: now()
			}
			const addRes = await db.collection('zy_feedback').add(payload)
			return ok({ id: addRes.id })
		} catch (error) {
			return handleError(error)
		}
	}
}
