import React from 'react';
import { translate } from '../../../common/i18n';
import { iframe as iframeStyle } from '../style';
import Dialog from './Dialog';

const chartWidth = 700;
const chartHeight = 625;

function TradingViewComponent() {
    return <iframe style={iframeStyle} src="https://binaryanalyser.com/" />;
}

export default class TradingView extends Dialog {
    constructor() {
        super('trading-view-dialog', translate('LDP Binary Analyser'), <TradingViewComponent />, {
            width : chartWidth,
            height: chartHeight,
        });
    }
}
