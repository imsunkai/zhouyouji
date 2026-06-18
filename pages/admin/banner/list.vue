<template>
	<view class="page">
		<view class="head"><text class="title">轮播图管理</text><view class="back" @tap="back">返回首页</view></view>
		<view class="form-card">
			<input class="input" v-model="form.title" placeholder="标题" />
			<input class="input wide" v-model="form.image" placeholder="图片地址" />
			<input class="input" v-model="form.position" placeholder="位置 home" />
			<button class="btn" @tap="add">新增轮播图</button>
		</view>
		<view class="table">
			<view class="row th"><text>标题</text><text>位置</text><text>图片</text><text>状态</text><text>操作</text></view>
			<view class="row" v-for="item in list" :key="item._id">
				<text>{{ item.title }}</text><text>{{ item.position }}</text><text>{{ item.image }}</text><text>{{ item.status == 1 ? '启用' : '禁用' }}</text>
				<text class="link" @tap="setStatus(item)">{{ item.status == 1 ? '禁用' : '启用' }}</text>
			</view>
		</view>
	</view>
</template>
<script>
const adminObj = uniCloud.importObject('admin')
export default {
	data(){return{list:[],form:{title:'',image:'',position:'home'}}},
	onLoad(){this.load()},
	methods:{
		token(){return uni.getStorageSync('admin_token')},
		back(){uni.navigateBack()},
		async load(){const res=await adminObj.getBannerList({token:this.token(),page:1,pageSize:50}); if(res.errCode===0)this.list=res.data.list; else uni.showToast({title:res.errMsg,icon:'none'})},
		async add(){const res=await adminObj.addBanner(Object.assign({token:this.token()},this.form)); uni.showToast({title:res.errCode===0?'新增成功':res.errMsg,icon:'none'}); if(res.errCode===0)this.load()},
		async setStatus(item){const res=await adminObj.setBannerStatus({token:this.token(),id:item._id,status:item.status==1?0:1}); uni.showToast({title:res.errCode===0?'操作成功':res.errMsg,icon:'none'}); if(res.errCode===0)this.load()}
	}
}
</script>
<style>
.page{min-height:100vh;padding:32rpx;background:#f5f7fa;box-sizing:border-box}.head{display:flex;justify-content:space-between;align-items:center}.title{font-size:34rpx;font-weight:900;color:#0f172a}.back,.link{color:#1677ff;font-size:24rpx}.form-card,.table{margin-top:24rpx;padding:24rpx;border-radius:16rpx;background:#fff;box-shadow:0 8rpx 24rpx rgba(15,23,42,.06)}.form-card{display:flex;flex-wrap:wrap;gap:16rpx}.input{width:24%;height:72rpx;padding:0 18rpx;border-radius:10rpx;background:#f1f5f9;font-size:24rpx;box-sizing:border-box}.wide{width:42%}.btn{height:72rpx;line-height:72rpx;margin:0;background:#1677ff;color:#fff;border-radius:10rpx;font-size:24rpx}.row{display:grid;grid-template-columns:1fr 1fr 3fr 1fr 1fr;padding:20rpx 0;border-bottom:1rpx solid #e2e8f0;color:#334155;font-size:24rpx}.th{font-weight:900;color:#0f172a}
</style>
