// @ts-check

import '@agoric/zoe/tools/prepare-test-env';

// eslint-disable-next-line import/no-extraneous-dependencies
import test from 'ava';

import bundleSource from '@agoric/bundle-source';
import { E } from '@agoric/eventual-send';
import { makeFakeVatAdmin } from '@agoric/zoe/src/contractFacet/fakeVatAdmin';
import { makeZoe } from '@agoric/zoe';
import { amountMath } from '@agoric/ertp';

const contractPath = `${__dirname}/../src/contract`;

test('group mint - successful application', async (t) => {
  try {

    const zoe = makeZoe(makeFakeVatAdmin().admin);

    // pack the contract
    const bundle = await bundleSource(contractPath);

    // install the contract
    const installation = await E(zoe).install(bundle);

    const { creatorFacet, instance } = await E(zoe).startInstance(
      installation,
      undefined,
      harden({ memberNames: ['dckc', 'ski'], quorum: 2, decimalPlaces: 2 }),
    );

    // Alice applies for funding
    const publicFacet = await E(zoe).getPublicFacet(instance);
    /** @type { Issuer } */
    const tokenIssuer = await E(publicFacet).getTokenIssuer();
    
    /** @param {Value} qty */
    const tokens = qty => amountMath.make(qty, tokenIssuer.getBrand());
    /** @type { Promise<Invitation> } */
    const applicationInvitation = await E(publicFacet).applyForFunding();
    const aliceSeat = await E(zoe).offer(applicationInvitation, harden({ want: { Token: tokens(10n)}}));

    // get the membership invitations
    const { dckc: dSeat, ski: sSeat } = await E(creatorFacet).getMembership();
    const dckc = await (await E(zoe).offer(dSeat)).getOfferResult();
    const ski = await (await E(zoe).offer(sSeat)).getOfferResult();
    await E(dckc).support(1);
    await E(ski).support(1);

    // @@Bob makes an offer using the invitation
    // const seat = await E(zoe).offer(invitation);

    const payment = await E(aliceSeat).getPayout('Token');
    const tokenPayoutAmount = await E(tokenIssuer).getAmountOf(payment);

    // Alice got 1000 tokens
    t.deepEqual(tokenPayoutAmount, tokens(10n));
  } catch (oops) {
    // @agoric/ses-ava not available yet
    console.log(oops);
    throw oops;
  }
});
