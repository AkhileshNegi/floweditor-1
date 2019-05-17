import { getRecipients, renderAssetList } from 'components/flow/actions/helpers';
import { fakePropType } from 'config/ConfigProvider';
import { BroadcastMsg } from 'flowTypes';
import * as React from 'react';

import styles from './SendBroadcast.module.scss';

export const PLACEHOLDER = "Send a message to the contact";

const MAX_TO_SHOW = 3;

const SendBroadcastComp: React.SFC<BroadcastMsg> = (
  action: BroadcastMsg,
  context: any
): JSX.Element => {
  const assets = getRecipients(action);
  if (action.text) {
    return (
      <div className={styles.node}>
        <div className={styles.to}>
          {renderAssetList(assets, MAX_TO_SHOW, context.config.endpoints)}
        </div>
        <div className={styles.message}>
          {action.text.split(/\r?\n/).map((line: string, idx: number) => (
            <div key={action.uuid + idx} className={styles.line}>
              {line}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <div className="placeholder">{PLACEHOLDER}</div>;
};

SendBroadcastComp.contextTypes = {
  config: fakePropType
};

export default SendBroadcastComp;
