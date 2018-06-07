'use strict';

module.exports = class ApiGatewayCleanStage {

	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;
		this.provider = this.serverless.getProvider('aws');

		this.hooks = {
			'after:aws:deploy:finalize:cleanup': this.deleteUnusedStages.bind(this),
		};
	}

	deleteUnusedStages() {
		this.serverless.cli.log('Starting delete unused stages...');

		return Promise.resolve()
			.then(() => {
				return this.getRestApiId();
			})
			.then(restApiId => {
				const { compiledCloudFormationTemplate } = this.serverless.service.provider;
				const currentStageName = this.getApiGatewayStageName(compiledCloudFormationTemplate);
				
				return this.getUnusedStages(restApiId, currentStageName)
					.then(unusedStages => {
						return this.deleteStages(restApiId, unusedStages);
					});
			});
	}

	getRestApiId() {
		const apiName = this.provider.naming.getApiGatewayName();

		return this.provider.request('APIGateway', 'getRestApis', {})
					.then(apis => apis.items.find(api => api.name === apiName).id);
	}

	getUnusedStages(restApiId, currentStageName) {
		return this.provider.request('APIGateway', 'getStages', {
			restApiId
		})
		.then(data => {
			return data.item.filter(item => item.stageName !== currentStageName);
		});
	}

	deleteStages(restApiId, stages) {
		return stages.reduce((memo, stage) => {
			return memo.then(() => {
				const { stageName } = stage;

				return this.provider.request('APIGateway', 'deleteStage', {
					restApiId,
					stageName
				})
				.then(() => `    Deleted stage: ${stageName}`);
			});
		}, Promise.resolve());
	}

	getApiGatewayStageName(template) {
		let stageNameStage, stageNameDeploy;

		Object.keys(template.Resources).forEach(key => {
			if (template.Resources[key]['Type'] == 'AWS::ApiGateway::Stage') {
				stageNameStage = template.Resources[key].Properties.StageName;
			}
			if (template.Resources[key]['Type'] == 'AWS::ApiGateway::Deployment') {
				stageNameDeploy = template.Resources[key].Properties.StageName;
			}
		});

		return stageNameStage ? stageNameStage : stageNameDeploy;
  }

}
