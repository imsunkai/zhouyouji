<template>
	<view class="page">
		<view class="head"><text class="title">咨询预约管理</text><view class="back" @tap="back">返回首页</view></view>
		<view class="table">
			<view class="row th"><text>姓名</text><text>电话</text><text>类型</text><text>内容</text><text>状态</text><text>操作</text></view>
			<view class="row" v-for="item in list" :key="item._id">
				<text>{{ item.name }}</text><text>{{ item.phone }}</text><text>{{ item.type }}</text><text>{{ item.content }}</text><text>{{ item.inquiry_status }}</text>
				<text class="link" @tap="done(item)">标记完成</text>
			</view>
		</view>
	</view>
</template>
<script>
const adminObj = uniCloud.importObject('admin')
export default {
	data(){return{list:[]}},
	onLoad(){this.load()},
	methods:{
		token(){return uni.getStorageSync('admin_token')},
		back(){uni.navigateBack()},
		async load(){const res=await adminObj.getInquiryList({token:this.token(),page:1,pageSize:50}); if(res.errCode===0)this.list=res.data.list; else uni.showToast({title:res.errMsg,icon:'none'})},
		async done(item){const res=await adminObj.updateInquiryStatus({token:this.token(),id:item._id,inquiryStatus:'done'}); uni.showToast({title:res.errCode===0?'操作成功':res.errMsg,icon:'none'}); if(res.errCode===0)this.load()}
	}
}
</script>
<style>
.page{min-height:100vh;padding:32rpx;background:#f5f7fa;box-sizing:border-box}.head{display:flex;justify-content:space-between;align-items:center}.title{font-size:34rpx;font-weight:900;color:#0f172a}.back,.link{color:#1677ff;font-size:24rpx}.table{margin-top:24rpx;padding:24rpx;border-radius:16rpx;background:#fff;box-shadow:0 8rpx 24rpx rgba(15,23,42,.06)}.row{display:grid;grid-template-columns:1fr 1fr 1fr 2fr 1fr 1fr;padding:20rpx 0;border-bottom:1rpx solid #e2e8f0;color:#334155;font-size:24rpx}.th{font-weight:900;color:#0f172a}
</style>
