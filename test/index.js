'use strict';

const test = require('ava');
const sinon = require('sinon');

const Plugin = require('..');

test('has hook', t => {
  const serverless = {
    getProvider: () => {}
  };

  const plugin = new Plugin(serverless);

  t.deepEqual(typeof plugin.hooks['after:aws:deploy:finalize:cleanup'], 'function');
  t.deepEqual(typeof plugin.deleteUnusedStages, 'function');
});

test('deleteUnusedStages calls delete on unused stages', t => {
  const serverless = {
    cli: {
      log: sinon.stub()
    },
    getProvider: () => {},
    service: {
      provider: {
        compiledCloudFormationTemplate: {}
      }
    }
  };

  const plugin = new Plugin(serverless);

  sinon.stub(plugin, 'getRestApiId').resolves('test-api-id');
  sinon.stub(plugin, 'getApiGatewayStageName').returns('test-stage-name');
  sinon.stub(plugin, 'getUnusedStages').resolves(['unused-stage-a']);
  sinon.stub(plugin, 'deleteStages').resolves();

  return plugin.deleteUnusedStages()
    .then(() => {
      t.true(plugin.getRestApiId.calledOnce);
      t.true(plugin.getApiGatewayStageName.calledOnce);
      t.true(plugin.getUnusedStages.calledOnce);
      t.true(plugin.deleteStages.calledOnce);

      t.deepEqual(plugin.getUnusedStages.firstCall.args, ['test-api-id', 'test-stage-name']);
      t.deepEqual(plugin.deleteStages.firstCall.args, ['test-api-id', ['unused-stage-a']]);
    });
});

test('getUnusedStages', t => {
  const request = sinon.stub().resolves({
    item: [{
      stageName: 'other-stage-name'
    }, {
      stageName: 'test-stage-name'
    }]
  });

  const serverless = {
    getProvider: () => {
      return {
        request
      };
    }
  };

  const plugin = new Plugin(serverless);

  return plugin.getUnusedStages('test-api-id', 'test-stage-name')
    .then(names => {
      t.deepEqual(names, [{ stageName: 'other-stage-name' }]);
    });
});

test('getRestApiId', t => {
  const request = sinon.stub().resolves({
    items: [{ id: 'abc', name: 'other-api-name' }, { id: 'def', name: 'test-api-name' }]
  });

  const serverless = {
    getProvider: () => {
      return {
        request,
        naming: {
          getApiGatewayName: () => 'test-api-name'
        }
      };
    },
  };

  const plugin = new Plugin(serverless);

  return plugin.getRestApiId()
    .then(id => {
      t.deepEqual(request.callCount, 1);
      t.deepEqual(id, 'def');
    });
});

test('deleteStages', t => {
  const request = sinon.stub().resolves();

  const serverless = {
    getProvider: () => {
      return {
        request
      };
    }
  };

  const plugin = new Plugin(serverless);

  return plugin.deleteStages('test-api-id', [{ stageName: 'test-stage-a' }, { stageNmae: 'test-stage-b' }])
    .then(() => {
      t.deepEqual(request.callCount, 2);
    });
});

test('getApiGatewayStageName picks the last ::Stage over ::Deployment', t => {
  const serverless = {
    getProvider: () => {}
  };

  const plugin = new Plugin(serverless);

  const stageName = plugin.getApiGatewayStageName({
    Resources: {
      Other: {
        Type: 'Other'
      },
      Foo: {
        Type: 'AWS::ApiGateway::Deployment',
        Properties: {
          StageName: 'Foo'
        }
      },
      Bar: {
        Type: 'AWS::ApiGateway::Stage',
        Properties: {
          StageName: 'Bar'
        }
      },
      Baz: {
        Type: 'AWS::ApiGateway::Stage',
        Properties: {
          StageName: 'Baz'
        }
      },
      Blah: {
        Type: 'AWS::ApiGateway::Deployment',
        Properties: {
          StageName: 'Blah'
        }
      }
    }
  });

  t.deepEqual(stageName, 'Baz');
});

test('getApiGatewayStageName picks the last ::Deployment with no ::Stage', t => {
  const serverless = {
    getProvider: () => {}
  };

  const plugin = new Plugin(serverless);

  const stageName = plugin.getApiGatewayStageName({
    Resources: {
      Other: {
        Type: 'Other'
      },
      Foo: {
        Type: 'AWS::ApiGateway::Deployment',
        Properties: {
          StageName: 'Foo'
        }
      },
      Blah: {
        Type: 'AWS::ApiGateway::Deployment',
        Properties: {
          StageName: 'Blah'
        }
      }
    }
  });

  t.deepEqual(stageName, 'Blah');
});