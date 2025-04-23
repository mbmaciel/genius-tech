import React from 'react';
import { translate } from '../../../common/i18n';
import { iframe as iframeStyle } from '../style';
import Dialog from './Dialog';

const chartWidth = 840;
const chartHeight = 280;

function Video1Component() {
    return <iframe style={iframeStyle} src="https://digitos.unobot.com.br/painel" />;
}

export default class Video1 extends Dialog {
    constructor() {
        super('video1-dialog', translate('Gráficos'), <Video1Component />, {
            width : chartWidth,
            height: chartHeight,
        });
    }
}
