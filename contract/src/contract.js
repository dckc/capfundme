// @ts-check
import '@agoric/zoe/exported';
// import { assert, details as X, q } from '@agoric/assert';
import { Far } from '@agoric/marshal';
import makeStore from '@agoric/store';
// import { assertProposalShape } from '@agoric/zoe/contractSupport';

/**
 * This is a very simple contract that creates a new issuer and mints payments
 * from it, in order to give an example of how that can be done.  This contract
 * sends new tokens to anyone who has an invitation.
 *
 * The expectation is that most contracts that want to do something similar
 * would use the ability to mint new payments internally rather than sharing
 * that ability widely as this one does.
 *
 * To pay others in tokens, the creator of the instance can make
 * invitations for them, which when used to make an offer, will payout
 * the specified amount of tokens.
 *
 * @type {ContractStartFn}
 */
const start = async (zcf) => {
  // ISSUE: duplicate names
  /** @type {{ decimalPlaces: number, memberNames: string[], quorum: number }} */
  const { decimalPlaces, memberNames, quorum } = zcf.getTerms();
  // TODO: validate terms

  // Create the internal token mint for a fungible digital asset. Note
  // that 'Tokens' is both the keyword and the allegedName.
  const zcfMint = await zcf.makeZCFMint(
    'Token',
    undefined,
    harden({ decimalPlaces }),
  );
  // AWAIT

  // Now that ZCF has saved the issuer, brand, and local amountMath, they
  // can be accessed synchronously.
  const { issuer } = zcfMint.getIssuerRecord();

  let nextItem = 0;
  // TODO: rejecting proposals
  /** @type { Store<number, { beneficiary: ZCFSeat, supporters: Map<ZCFSeat, string>}> } */
  const proposals = makeStore('proposal');

  /** @type { OfferHandler } */
  const applicationHander = (beneficiary) => {
    nextItem += 1;
    proposals.init(nextItem, { beneficiary, supporters: new Map() });
    return nextItem;
  };

  const makeMembershipInvitation = (name) => {
    /** @type { OfferHandler} */
    const handler = (seat) =>
      Far('member', {
        /** @param {number} item */
        support(item) {
          const { beneficiary, supporters } = proposals.get(item);
          supporters.set(seat, name);
          console.log('@@supporters', [...supporters.values()]);
          proposals.set(item, { beneficiary, supporters });
          if (supporters.size >= quorum) {
            const proposal = beneficiary.getProposal();
            console.log('@@@minting', proposal.want);
            zcfMint.mintGains(proposal.want, beneficiary);
            beneficiary.exit();
          }
        },
      });
    return zcf.makeInvitation(handler, '@@WG name', { name });
  };
  const membership = Object.fromEntries(
    memberNames.map((name) => [name, makeMembershipInvitation(name)]),
  );

  const creatorFacet = {
    getMembership: () => membership,
    getTokenIssuer: () => issuer,
  };
  const publicFacet = {
    getTokenIssuer: () => issuer,
    applyForFunding: () =>
      zcf.makeInvitation(applicationHander, 'application for funding'),
  };

  // Return the creatorFacet to the creator, so they can make
  // invitations for others to get payments of tokens. Publish the
  // publicFacet.
  return harden({ creatorFacet, publicFacet });
};

harden(start);
export { start };
