<template>
	<view class="admin-page">
		<view class="sidebar">
			<text class="brand">舟游记后台</text>
			<view class="menu active">
				<text>控制台</text>
			</view>
			<view class="menu" v-for="item in menus" :key="item.url" @tap="go(item.url)">
				<text>{{ item.title }}</text>
			</view>
		</view>

		<view class="main">
			<view class="topbar">
				<view>
					<text class="page-title">后台管理首页</text>
					<text class="page-subtitle">欢迎，{{ adminName }}</text>
				</view>
				<view class="logout-btn" @tap="logout">
					<text>退出登录</text>
				</view>
			</view>

			<view class="stats">
				<view class="stat-card">
					<text class="stat-num">{{ stats.serviceCount }}</text>
					<text class="stat-label">服务项目</text>
				</view>
				<view class="stat-card">
					<text class="stat-num">{{ stats.inquiryCount }}</text>
					<text class="stat-label">咨询预约</text>
				</view>
				<view class="stat-card">
					<text class="stat-num">{{ stats.carCount }}</text>
					<text class="stat-label">二手车</text>
				</view>
				<view class="stat-card">
					<text class="stat-num">{{ stats.bannerCount }}</text>
					<text class="stat-label">轮播图</text>
				</view>
			</view>

			<view class="section-title">管理入口</view>
			<view class="entry-grid">
				<view class="entry-card" v-for="item in menus" :key="item.url" @tap="go(item.url)">
					<text class="entry-title">{{ item.title }}</text>
					<text class="entry-desc">{{ item.desc }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
const adminAuth = uniCloud.importObject('adminAuth')
const adminObj = uniCloud.importObject('admin')

export default {
	data() {
		return {
			admin: null,
			stats: {
				serviceCount: 0,
				inquiryCount: 0,
				carCount: 0,
				bannerCount: 0
			},
			menus: [
				{ title: '服务项目管理', desc: '新增、查看、上下架旅游/车服项目', url: '/pages/admin/service/list' },
				{ title: '咨询预约管理', desc: '查看用户咨询并修改处理状态', url: '/pages/admin/inquiry/list' },
				{ title: '二手车管理', desc: '新增、查看、上下架二手车源', url: '/pages/admin/used-car/list' },
				{ title: '轮播图管理', desc: '新增、查看、上下架首页轮播图', url: '/pages/admin/banner/list' }
			]
		}
	},
	computed: {
		adminName() {
			if (!this.admin) return ''
			return this.admin.nickname || this.admin.username || ''
		}
	},
	onLoad() {
		this.checkLogin()
	},
	methods: {
		token() {
			return uni.getStorageSync('admin_token')
		},
		goLogin() {
			uni.removeStorageSync('admin_token')
			uni.redirectTo({ url: '/pages/admin/login/login' })
		},
		async checkLogin() {
			const token = this.token()
			if (!token) {
				this.goLogin()
				return
			}
			try {
				const res = await adminAuth.checkLogin({ token })
				if (res.errCode !== 0) {
					this.goLogin()
					return
				}
				this.admin = res.data.admin
				this.loadDashboard()
			} catch (error) {
				this.goLogin()
			}
		},
		async loadDashboard() {
			const res = await adminObj.getDashboard({ token: this.token() })
			if (res.errCode === 0) this.stats = res.data
		},
		go(url) {
			uni.navigateTo({ url })
		},
		async logout() {
			const token = this.token()
			try {
				if (token) await adminAuth.logout({ token })
			} finally {
				uni.removeStorageSync('admin_token')
				uni.redirectTo({ url: '/pages/admin/login/login' })
			}
		}
	}
}
</script>

<style>
.admin-page {
	min-height: 100vh;
	background: #f5f7fa;
	display: flex;
	flex-direction: row;
}

.sidebar {
	width: 260rpx;
	min-height: 100vh;
	padding: 32rpx 20rpx;
	background: #0f172a;
	box-sizing: border-box;
}

.brand {
	display: block;
	margin-bottom: 34rpx;
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 900;
}

.menu {
	height: 76rpx;
	padding: 0 22rpx;
	margin-bottom: 12rpx;
	border-radius: 12rpx;
	color: #cbd5e1;
	font-size: 24rpx;
	display: flex;
	align-items: center;
	box-sizing: border-box;
}

.menu.active,
.menu:hover {
	background: #1677ff;
	color: #ffffff;
}

.main {
	flex: 1;
	padding: 32rpx;
	box-sizing: border-box;
}

.topbar {
	padding: 30rpx 34rpx;
	border-radius: 16rpx;
	background: #ffffff;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

.page-title {
	display: block;
	color: #0f172a;
	font-size: 36rpx;
	font-weight: 900;
}

.page-subtitle {
	display: block;
	margin-top: 10rpx;
	color: #64748b;
	font-size: 24rpx;
}

.logout-btn {
	min-width: 140rpx;
	height: 64rpx;
	padding: 0 24rpx;
	border-radius: 999rpx;
	background: #f1f5f9;
	color: #334155;
	font-size: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.stats {
	margin-top: 28rpx;
	display: flex;
	flex-direction: row;
	gap: 24rpx;
}

.stat-card {
	flex: 1;
	min-height: 150rpx;
	padding: 30rpx;
	border-radius: 16rpx;
	background: #ffffff;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

.stat-num {
	color: #1677ff;
	font-size: 46rpx;
	font-weight: 900;
}

.stat-label {
	margin-top: 10rpx;
	color: #64748b;
	font-size: 24rpx;
}

.section-title {
	margin-top: 34rpx;
	margin-bottom: 20rpx;
	color: #0f172a;
	font-size: 30rpx;
	font-weight: 900;
}

.entry-grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	gap: 24rpx;
}

.entry-card {
	width: calc(50% - 12rpx);
	min-height: 180rpx;
	padding: 32rpx;
	border-radius: 16rpx;
	background: #ffffff;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.entry-card:hover {
	box-shadow: 0 12rpx 34rpx rgba(22, 119, 255, 0.16);
}

.entry-title {
	color: #0f172a;
	font-size: 30rpx;
	font-weight: 900;
}

.entry-desc {
	margin-top: 16rpx;
	color: #64748b;
	font-size: 24rpx;
	line-height: 34rpx;
}
</style>
