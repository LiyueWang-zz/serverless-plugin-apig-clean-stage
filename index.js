'use strict';

module.exports = class ApiGatewayCleanStage {

	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;
		this.provider = this.serverless.getProvider('aws');
		this.apiGateway = new this.provider.sdk.APIGateway({
			region: this.options.region?this.options.region:'us-east-1'
		});

		this.hooks = {
			'after:aws:deploy:finalize:cleanup': this.deleteUselessStages.bind(this),
		};
	}

	deleteUselessStages(){
		this.serverless.cli.log('Starting delete useless stages...');

		const template = this.serverless.service.provider.compiledCloudFormationTemplate;
		let currentStageName, stageNameStage, stageNameDeployment;
		Object.keys(template.Resources).forEach(function(key){
			if (template.Resources[key]['Type'] == 'AWS::ApiGateway::Stage') {
				stageNameStage = template.Resources[key].Properties.StageName;
			}
			if (template.Resources[key]['Type'] == 'AWS::ApiGateway::Deployment') {
				stageNameDeployment = template.Resources[key].Properties.StageName;
			}
		});

		currentStageName = stageNameStage? stageNameStage: stageNameDeployment;

		Promise.resolve()
			.then(()=>{
				return this.getRestApiId()
				.then( restApiId => {
					return this.apiGateway.getStages({
						restApiId
					})
					.promise()
					.then((data) => {
						const apiGateway = this.apiGateway;
						return data.item.forEach(function(item){
							if (item.stageName !== currentStageName) {
								return apiGateway.deleteStage({
									restApiId: restApiId,
									stageName: item.stageName
								})
								.promise()
								.then(() => '    Deleted stage: ' + item.stageName);
							}
						});
					})
				})
			});
	}

	getRestApiId(){
		const apiName = this.provider.naming.getApiGatewayName();
		return this.apiGateway.getRestApis()
					.promise()
					.then( apis => apis.items.find(api => api.name === apiName).id);
	}

}
