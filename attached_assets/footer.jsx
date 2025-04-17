import React from 'react';
import { translate, createUrl } from '../../common/utils/tools';

const SocialIcons = ({ networks }) => (
    <div id='social-icons' className='social-icons flex-row'>
        {networks.map((net, idx) => (
            <a key={idx} href={net.href} target='_blank' rel='noopener noreferrer'>
                <img src={`image/footer/${net.media}.svg`} />
            </a>
        ))}
    </div>
);

const Footer = () => (
    <div id="footer-container">
        <div id='footer-regulatory' className='primary-bg-color-dark gr-padding-10"'>
            <div className='container eu-hide invisible'>
                <div className='gr-row'>
                    <div className='gr-12'>
                        <div className='icon-row flex-row gr-child'>
                            <div className='regulation-logos flex-row'>
                                <a className='vanuatu-icon' href='https://www.vfsc.vu/' target='_blank' rel='noopener noreferrer'>
                                    <img className='responsive' src={'image/footer/vanuatu-logo.png'} />
                                </a>
                                <a className='bvi-icon' href='http://www.bvifsc.vg/' target='_blank' rel='noopener noreferrer'>
                                    <img className='responsive' src={'image/footer/bvi.png'} />
                                </a>
                                <a className='labuan-icon' href='https://www.labuanibfc.com/' target='_blank' rel='noopener noreferrer'>
                                    <img className='responsive' src={'image/footer/labuan_FSA.svg'} />
                                </a>
                            </div>
                            <SocialIcons
                                networks={[
                                    { media: 'facebook', href: 'https://www.facebook.com/onebot' },
                                ]}
                            />
                        </div>
                    </div>
                </div>
                <div className='gr-row'>
                    <div className='gr-12'>
                        <fieldset className='fld-risk-warning'>
                            <legend>AVISO DE RISCO</legend>
                            <p>Os produtos disponibilizados através deste site incluem opções binárias, contratos por diferenças ("CFDs") e outros derivados complexos. A negociação de opções binárias pode não ser adequada para todos. A negociação de CFDs implica um elevado grau de risco, uma vez que a alavancagem pode trabalhar tanto para a sua vantagem como para a sua desvantagem. Como resultado, os produtos disponibilizados neste site podem não ser adequados para todo o tipo de investidor, devido ao risco de se perder todo o capital investido. Nunca se deve investir dinheiro que precisa e nunca se deve negociar com dinheiro emprestado. Antes de negociar os complexos produtos disponibilizados, certifique-se de que compreenda os riscos envolvidos e aprenda mais sobre a negociação responsável.</p>
                        </fieldset>
                    </div>
                </div>
            </div>
            <div className='container eu-show invisible'>
                <div className='gr-row'>
                    <div className='gr-12'>
                        <div className='icon-row flex-row'>
                            <div className='regulation-logos flex-row'>
                                <a className='iom-icon' href='https://www.gov.im/gambling/' target='_blank' rel='noopener noreferrer'>
                                    <img className='responsive' src={'image/footer/isle-of-man.png'} />
                                </a>
                                <div className='lga-gamstop-icon-container'>
                                    <a className='gamstop-icon' href='https://www.gamstop.co.uk' target='_blank' rel='noopener noreferrer'>
                                        <img className='responsive' src={'image/footer/gamstop.svg'} />
                                    </a>
                                    <a className='lga-icon' href='https://www.authorisation.mga.org.mt/verification.aspx?lang=EN&company=a5fd1edc-d072-4c26-b0cd-ab3fa0f0cc40&details=1' target='_blank' rel='noopener noreferrer'>
                                        <img className='responsive' src={'image/footer/mga-logo-footer.svg'} />
                                    </a>
                                </div>
                                <div className='age-restriction'>
                                    <img className='responsive' src={'image/footer/18+.svg'} />
                                </div>
                            </div>
                            <SocialIcons
                                networks={[
                                    { media: 'youtube', href: 'https://www.youtube.com/user/BinaryTradingVideos' },
                                    { media: 'facebook', href: 'https://www.facebook.com/binarydotcom' },
                                    { media: 'twitter', href: 'https://twitter.com/Binarydotcom' },
                                    { media: 'telegram', href: 'https://t.me/binarydotcom' },
                                    { media: 'reddit', href: 'https://www.reddit.com/r/binarydotcom/' },
                                ]}
                            />
                        </div>
                    </div>
                </div>
                <div className='gr-row'>
                    <div className='gr-12'>
                        <p>
                            {translate(['In the EU, financial products are offered by Binary Investments (Europe) Ltd., W Business Centre, Level 3, Triq Dun Karm, Birkirkara, BKR 9033, Malta, licensed and regulated as a Category 3 Investment Services provider by the Malta Financial Services Authority (licence no. IS/70156).'])}
                        </p>
                        <p>
                            {translate(['In the Isle of Man and the UK, Volatility Indices are offered by Binary (IOM) Ltd., First Floor, Millennium House, Victoria Road, Douglas, IM2 4RW, Isle of Man, British Isles; licensed and regulated respectively by (1) the Gambling Supervision Commission in the Isle of Man (current licence issued on 31 August 2017) and by (2) the Gambling Commission in the UK (licence [_1]reference no: 39172[_2]).', '<a href="https://secure.gamblingcommission.gov.uk/PublicRegister/Search/Detail/39172" target="_blank" rel="noopener noreferrer">', '</a>'])}
                        </p>
                        <p>
                            {translate(['In the rest of the EU, Volatility Indices are offered by Binary (Europe) Ltd., W Business Centre, Level 3, Triq Dun Karm, Birkirkara, BKR 9033, Malta; licensed and regulated by (1) the Malta Gaming Authority in Malta (licence no. MGA/B2C/102/2000 issued on 01 August 2018), for UK clients by (2) the UK Gambling Commission (licence [_1]reference no: 39495[_2]), and for Irish clients by (3) the Revenue Commissioners in Ireland (Remote Bookmaker\'s Licence no. 1010285 issued on 1 July 2017). View complete [_3]Regulatory Information[_2].', '<a href="https://secure.gamblingcommission.gov.uk/PublicRegister/Search/Detail/39495" target="_blank" rel="noopener noreferrer">', '</a>', `<a href="${createUrl({ path: 'regulation', addLanguage: true, addHtmlExtension: true, isNonBotPage: true })}">`])}
                        </p>
                    </div>
                </div>
                <div className='gr-row'>
                    <div className='gr-12'>
                        <div className='about-binary'>
                            <p>
                                {translate(['Binary.com is an award-winning online trading provider that helps its clients to trade on financial markets through binary options and CFDs. Trading binary options and CFDs on Volatility Indices is classified as a gambling activity. Remember that gambling can be addictive – please play responsibly. Learn more about [_1]Responsible Trading[_2]. Some products are not available in all countries. This website\'s services are not made available in certain countries such as the USA, Canada, Hong Kong, or to persons under age 18.', `<a href="${createUrl({ path: 'responsible-trading', addLanguage: true, addHtmlExtension: true, isNonBotPage: true })}">`, '</a>'])}
                            </p>
                        </div>
                    </div>
                </div>
                <div className='gr-row'>
                    <div className='gr-12'>
                        <div className='risk-warning'>
                            <p>
                                {translate(['Trading binary options may not be suitable for everyone, so please ensure that you fully understand the risks involved. Your losses can exceed your initial deposit and you do not own or have any interest in the underlying asset.'])}
                            </p>
                            <p className='eu-only invisible'>
                                {translate(['CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. 78.6% of retail investor accounts lose money when trading CFDs. You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.'])}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id='end-note' className='invisible content-inverse-color center-text' />
    </div>
);

export default Footer;
