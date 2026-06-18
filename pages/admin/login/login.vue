<template>
	<view class="page">
		<view class="login-card">
			<text class="title">后台登录</text>
			<text class="subtitle">舟游记管理后台</text>

			<view class="form">
				<view class="field">
					<text class="label">账号</text>
					<input
						class="input"
						v-model="username"
						placeholder="请输入管理员账号"
						placeholder-class="placeholder"
					/>
				</view>
				<view class="field">
					<text class="label">密码</text>
					<input
						class="input"
						v-model="password"
						password
						placeholder="请输入管理员密码"
						placeholder-class="placeholder"
					/>
				</view>
			</view>

			<button class="login-btn" :loading="loading" @tap="login">登录</button>
		</view>
	</view>
</template>

<script>
const adminAuth = uniCloud.importObject('adminAuth')

export default {
	data() {
		return {
			username: '',
			password: '',
			loading: false
		}
	},
	methods: {
		async login() {
			const username = this.username.trim()
			const password = this.password.trim()
			if (!username) {
				uni.showToast({ title: '请输入管理员账号', icon: 'none' })
				return
			}
			if (!password) {
				uni.showToast({ title: '请输入管理员密码', icon: 'none' })
				return
			}

			this.loading = true
			try {
				const res = await adminAuth.login({ username, password })
				if (res.errCode !== 0) {
					uni.showToast({ title: res.errMsg || '登录失败', icon: 'none' })
					return
				}
				uni.setStorageSync('admin_token', res.data.token)
				uni.redirectTo({
					url: '/pages/admin/index/index'
				})
			} catch (error) {
				uni.showToast({ title: '登录失败，请检查云对象', icon: 'none' })
			} finally {
				this.loading = false
			}
		}
	}
}
</script>

<style>
.page {
	min-height: 100vh;
	padding: 120rpx 40rpx 40rpx;
	box-sizing: border-box;
	background: #f5f7fa;
	display: flex;
	align-items: flex-start;
	justify-content: center;
}

.login-card {
	width: 720rpx;
	max-width: 420px;
	padding: 48rpx 36rpx;
	border-radius: 20rpx;
	background: #ffffff;
	box-shadow: 0 12rpx 32rpx rgba(30, 48, 84, 0.08);
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

.title {
	color: #07152d;
	font-size: 40rpx;
	font-weight: 800;
}

.subtitle {
	margin-top: 12rpx;
	color: #667085;
	font-size: 26rpx;
}

.form {
	margin-top: 44rpx;
}

.field {
	margin-bottom: 28rpx;
}

.label {
	display: block;
	margin-bottom: 14rpx;
	color: #344054;
	font-size: 26rpx;
	font-weight: 700;
}

.input {
	height: 88rpx;
	padding: 0 24rpx;
	border-radius: 12rpx;
	background: #f2f4f7;
	color: #101828;
	font-size: 28rpx;
	box-sizing: border-box;
}

.placeholder {
	color: #98a2b3;
}

.login-btn {
	min-height: 88rpx;
	line-height: 88rpx;
	margin-top: 14rpx;
	border-radius: 999rpx;
	background: #1677ff;
	color: #ffffff;
	font-size: 30rpx;
	font-weight: 800;
}

.login-btn::after {
	border: 0;
}
</style>
