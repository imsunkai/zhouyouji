const WEIXIN_CLOUD_ENV = 'cloud1-d8gsb809j07104a62'

let cloudReady = false

function ensureCloudReady() {
	// #ifdef MP-WEIXIN
	if (!cloudReady && typeof wx !== 'undefined' && wx.cloud) {
		wx.cloud.init({
			env: WEIXIN_CLOUD_ENV,
			traceUser: true
		})
		cloudReady = true
	}
	// #endif
}

export function callCloudObject(objectName, methodName, params = {}) {
	// #ifdef MP-WEIXIN
	ensureCloudReady()
	return new Promise((resolve, reject) => {
		wx.cloud.callFunction({
			name: 'api',
			data: {
				object: objectName,
				method: methodName,
				params: params || {}
			},
			success(res) {
				resolve(res.result)
			},
			fail(err) {
				reject(err)
			}
		})
	})
	// #endif

	// #ifndef MP-WEIXIN
	return Promise.reject(new Error('当前后端已切换为微信云开发，请在微信小程序环境运行'))
	// #endif
}

export function uploadCloudFile(cloudPath, filePath) {
	// #ifdef MP-WEIXIN
	ensureCloudReady()
	return new Promise((resolve, reject) => {
		wx.cloud.uploadFile({
			cloudPath,
			filePath,
			success(res) {
				resolve(res.fileID || '')
			},
			fail(err) {
				reject(err)
			}
		})
	})
	// #endif

	// #ifndef MP-WEIXIN
	return Promise.reject(new Error('当前后端已切换为微信云开发，请在微信小程序环境运行'))
	// #endif
}

export function createCloudObject(objectName) {
	return {
		wxLogin(params = {}) {
			return callCloudObject(objectName, 'wxLogin', params)
		},
		getUserInfo(params = {}) {
			return callCloudObject(objectName, 'getUserInfo', params)
		},
		updateProfile(params = {}) {
			return callCloudObject(objectName, 'updateProfile', params)
		},
		getMyCenter(params = {}) {
			return callCloudObject(objectName, 'getMyCenter', params)
		},
		getOrders(params = {}) {
			return callCloudObject(objectName, 'getOrders', params)
		},
		getOrderDetail(params = {}) {
			return callCloudObject(objectName, 'getOrderDetail', params)
		},
		getFavorites(params = {}) {
			return callCloudObject(objectName, 'getFavorites', params)
		},
		getAddresses(params = {}) {
			return callCloudObject(objectName, 'getAddresses', params)
		},
		saveAddress(params = {}) {
			return callCloudObject(objectName, 'saveAddress', params)
		},
		getCoupons(params = {}) {
			return callCloudObject(objectName, 'getCoupons', params)
		},
		getBrowseHistory(params = {}) {
			return callCloudObject(objectName, 'getBrowseHistory', params)
		},
		submitFeedback(params = {}) {
			return callCloudObject(objectName, 'submitFeedback', params)
		},
		getHomeRecommend(params = {}) {
			return callCloudObject(objectName, 'getHomeRecommend', params)
		},
		getCategoryList(params = {}) {
			return callCloudObject(objectName, 'getCategoryList', params)
		},
		getListByCategory(params = {}) {
			return callCloudObject(objectName, 'getListByCategory', params)
		},
		getList(params = {}) {
			return callCloudObject(objectName, 'getList', params)
		},
		getDetail(params = {}) {
			return callCloudObject(objectName, 'getDetail', params)
		}
	}
}
